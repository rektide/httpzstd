"use strict"

const util= require( "util")
const fs= require( "fs")
const http2= require( "http2")
const URL= require( "url").URL
const Tar= require( "tar-stream")

const open= util.promisify( fs.open)
const close= util.promisify( fs.close)

/**
* Our http/2 server instance
* @var
* @global
*/
const server= http2.createServer()

/**
* @var
* @global
*/
const tar= tar.pack()

/**
* A list of active http2 sessions, which will receive pushed assets
* @var
* @global
*/
const sessions= Map()
function saveStream( stream){
	if( !stream.pushAllowed){
		return
	}

	var session= stream.session
	// see if we know this session
	var existingStream= sessions.get( session)
	if( !existingStream){
		// remove our record of the session when it's done
		function unsave(){
			// GEE IT SURE WOULD BE NICE TO BE ABLE TO USE WEAKMAP TO FREE US FROM RESPONSIBLY GC'ing OURSELVES
			sessions.delete( session)
			// remove this handler's installs
			session.remove( "close", unsave)
			session.remove( "goaway", unsave)
			// it's the only way to be sure
			session= null
		}
		session.on( "close", unsave)
		session.on( "goaway", unsave)
	}

	// record
	sessions.set( stream.session, stream)
}

server.on("stream", (stream, headers, flags)=> {
	const url= new URL(headers[http2.constants.HTTP2_HEADER_PATH])

	// submit route
	if( path.startsWith( "/submit")){
		submit(stream, headers, flags, url)
		retun
	}

	saveStream( stream)
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
	const all= sessions.values().map(session=> {
		// push the submitted file to each client
		const path= "/httpzstd/" + session.sequence++
		return util.promisify( session.stream.pushStream.bind( session.stream))
			.then( pushStream=> {
				const headers= {
					":path": path
				}
				pushStream.respondWithFD( fd, headers)
			})
	})
	return Promise.all(all).then(_=> close( fd))
}

server.listen(process.env.HTTZSTD_PORT|| process.env.NODE_PORT|| process.env.PORT, 80)
