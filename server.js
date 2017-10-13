"use strict"

const http2= require( "http2")

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
const sessions= new Map()
/**
* Look at a stream and create a new httpzstd session or attach the existing one, as applicable
* @var
* @global
*/
function httpzstdSession( stream){
	const session= stream.session
	const existing= sessions.get( session)
	const created= existing|| { session}
	if( created!== existing){
		sessions.set( created)
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
	const path= headers[http2.constants.HTTP2_HEADER_PATH]

	// submit route
	if( path== "/submit"){
		return submit(stream, headers, flags)
	}

	// ... explicitly do nothing, leaving this request open to "encourage" the http2 stream to stay open, ready for push
})

/**
* Submit a file that will be sent to all connected clients
*/
function submit(stream, headers, flags){
	
}

server.listen(process.env.NODE_PORT|| process.env.PORT|| 80)
