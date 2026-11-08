const {test}=require('node:test');
const assert=require('node:assert/strict');
const net=require('node:net');
const {once}=require('node:events');
const {sourceProxy}=require('../lib/traffic-clients.cjs');
test('restricted tunnel preserves source IP and bytes; external destinations are refused',async()=>{
  const target=net.createServer(socket=>{assert.equal(socket.remoteAddress,'127.0.0.12');socket.pipe(socket);});
  target.listen(0,'127.0.0.1');await once(target,'listening');
  const proxy=await sourceProxy('127.0.0.12',target.address().port);
  const port=Number(new URL(proxy.url).port);
  try {
    const socket=net.connect(port,'127.0.0.1');await once(socket,'connect');
    socket.write(`CONNECT 127.0.0.1:${target.address().port} HTTP/1.1\r\nHost: local\r\n\r\n`);
    const [header]=await once(socket,'data');assert.match(header.toString(),/200 Connection/);
    socket.write('TLS bytes remain unchanged');
    const [body]=await once(socket,'data');assert.equal(body.toString(),'TLS bytes remain unchanged');socket.destroy();
    const denied=net.connect(port,'127.0.0.1');await once(denied,'connect');
    denied.write('CONNECT example.com:443 HTTP/1.1\r\nHost: external\r\n\r\n');
    const [failure]=await once(denied,'data');assert.match(failure.toString(),/403/);denied.destroy();
  } finally {await proxy.close();await new Promise(resolve=>target.close(resolve));}
});
