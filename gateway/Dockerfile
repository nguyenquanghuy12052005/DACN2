FROM golang:1.27.3-bookworm AS build
WORKDIR /src
ENV GOTOOLCHAIN=local CGO_ENABLED=0
COPY go.mod go.sum ./
RUN go mod download && go mod verify
COPY *.go ./
RUN go build -trimpath -o /out/gateway .

FROM scratch AS runtime
WORKDIR /app
COPY --from=build /out/gateway /app/gateway
USER 65534:65534
EXPOSE 8443
ENTRYPOINT ["/app/gateway"]
