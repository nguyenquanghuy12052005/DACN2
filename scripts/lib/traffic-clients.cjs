'use strict';
const http=require('node:http');
const http2=require('node:http2');
const net=require('node:net');
const {once}=require('node:events');
const {setTimeout:delay}=require('node:timers/promises');

// A restricted byte tunnel: Chrome still performs TLS directly with Gateway.
// Each tunnel binds a real loopback source address, never an identity header.
async function sourceProxy(localAddress, gatewayPort=18444) {
  if(!/^127\.0\.0\.(\d+)$/.test(localAddress)||Number(localAddress.split('.').pop())<2||Number(localAddress.split('.').pop())>254) throw Error('Loopback source alias required');
  const sockets=new Set();
  const server=http.createServer((req,res)=>{res.writeHead(403);res.end();});
  server.on('connect',(req,client,head)=>{
    if(req.url!==`127.0.0.1:${gatewayPort}`||sockets.size>=16) {client.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}
    const upstream=net.connect({host:'127.0.0.1',port:gatewayPort,localAddress});
    for(const socket of [client,upstream]) {
      sockets.add(socket); socket.setTimeout(10000,()=>socket.destroy());
      socket.on('error',()=>{client.destroy();upstream.destroy();});
      socket.on('close',()=>{sockets.delete(socket);client.destroy();upstream.destroy();});
    }
    upstream.once('connect',()=>{
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if(head.length) upstream.write(head);
      client.pipe(upstream); upstream.pipe(client);
    });
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  return {url:`http://127.0.0.1:${server.address().port}`,close:async()=>{
    for(const socket of sockets)socket.destroy();
    await new Promise(resolve=>server.close(resolve));
  }};
}
async function nodeClient({localAddress,ca,token}) {
  const session=http2.connect('https://127.0.0.1:18444',{ca,servername:'localhost',localAddress});
  session.on('error',()=>{});
  const timeout=setTimeout(()=>session.destroy(Error('Connect timeout')),4000);
  try {await once(session,'connect');} finally {clearTimeout(timeout);}
  session.setLocalWindowSize(16*1024*1024);
  await delay(20);
  return {close:()=>session.destroy(),send:(route,body,spoof=false)=>new Promise((resolve,reject)=>{
    const headers={':method':body?'POST':'GET',':path':route,origin:'http://127.0.0.1:5173',
      'x-dacn2-session':token,'user-agent':spoof?'Mozilla/5.0 Chrome/157.0.0.0 Safari/537.36':`DACN2-Node/${process.versions.node}`,
      ...(body?{'content-type':'application/json'}:{})};
    const request=session.request(headers);
    let response,size=0;
    request.setTimeout(4000,()=>request.destroy(Error('Request timeout')));
    request.on('response',h=>response=h);
    request.on('data',chunk=>{size+=chunk.length;if(size>65536)request.destroy(Error('Response limit'));});
    request.on('error',reject);
    request.on('end',()=>{
      if(!response)return reject(Error('Upstream stream ended without response headers'));
      resolve({status:response[':status'],request_id:response['x-request-id'],
        connection_id:response['x-dacn2-connection-id'],protocol:response['x-dacn2-protocol']});
    });
    request.end(body?JSON.stringify(body):undefined);
  })};
}
module.exports={sourceProxy,nodeClient};
