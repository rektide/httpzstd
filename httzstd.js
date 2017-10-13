"use strict"

const http2= require("http2")

const server= http2.createServer()

server.on("stream", (stream, headers)=> {
})

server.listen(process.env.NODE_PORT|| process.env.PORT|| 80)
