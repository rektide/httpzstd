"use strict"

const util= require( "util")
const fs= require( "fs")
const http2= require( "http2")
const URL= require( "url").URL

const open= util.promisify( fs.open)
const close= util.promisify( fs.close)

/**
* Our http/2 server instance
* @var
* @global
*/
const server= http2.createServer()

/**
* A list of active http2 sessions, which will receive pushed assets
* @var
* @global
*/
const sessions= new WeakMap()
/**
* Look at a stream and create a new httpzstd session or attach the existing one, as applicable
* @var
* @global
*/
function httpzstdSession( stream){
	const session= stream.session
	const existing= sessions.get( session)
	const created= existing|| {
		session,
		stream,
		sequence: 0
	}
	if( created!== existing){
		sessions.set( created)
	}else{
		// up date the stream we'll push in reply to to this more-recent stream
		existing.stream= stream
	}
	return created
}
/**
* Remove a stream as it closes
* @listens close
*/
server.on("close", (session)=> {
	sessions.delete( session)
})

server.on("stream", (stream, headers, flags)=> {
	const url= new URL(headers[http2.constants.HTTP2_HEADER_PATH])

	// submit route
	if( path.startsWith( "/submit")){
		submit(stream, headers, flags, url)
		retun
	}

	httpzstdSession( stream)
	// ... explicitly do nothing, leaving this request open to "encourage" the http2 stream to stay open, ready for push
})

/**
* Submit a file that will be sent to all connected clients
*/
async function submit(stream, headers, flags, url){
	const path= url.searchParams.get("filename")
	if( !path){
		stream.respond({
			":status": 400
		})
		stream.end("");
		return
	}
	const fd= await open( path)
	const headers= {
		":path": null
	}
	const all= sessions.values().map(session=> {
		headers[":path"]= "/httpzstd/" + session.sequence++
		// push the submitted file to each client
		// next we are going to push zstd buffers! yay!
		session.respondWithFD( fd, headers)
	})
	return Promise.all(all).then(_=> close( fd))
}

server.listen(process.env.HTTZSTD_PORT|| process.env.NODE_PORT|| process.env.PORT, 80)
