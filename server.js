"use strict"

const util= require( "util")
const fs= require( "fs")
const http2= require( "http2")
const URL= require( "url").URL
const Tar= require( "tar-stream")
const zstd= require( "node-zstd2")

const open= util.promisify( fs.open)
const fstat= util.promisify( fs.fstat)

/**
* Our http/2 server instance
* @var
* @global
*/
const server= http2.createServer()

/**
* Stream of tar entries
* @var
* @global
*/
const tar= Tar.pack()
const seq= 0
/**
* List of files needing to be sent
*/
const fileQueue= []

const pushStreams= new Map()
const pendingPushes= new Map()
function saveStream( stream){
	if( !stream.pushAllowed){
		return
	}

	var session= stream.session
	// see if we know this session
	var existingStream= pushStreams.get( session)
	if( existingStream){
		return
	}

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

	stream.pushStream({
		":path": "/httpzstd/"+ seq // does not signify anything in particular
	}, pushStream=> {
		// ok to begin sending stream to client
		pushStream.respond({ ":status": 200})

		// generate zstd stream
		var zstream= zstd.compressStream()
		// add to list of pending pushStreams
		pendingPushes.set( stream, zstream)
	})
}

server.on( "stream", (stream, headers, flags)=> {
	const url= new URL(headers[http2.constants.HTTP2_HEADER_PATH])

	// submit route
	if( path.startsWith( "/submit")){
		submit(stream, headers, flags, url)
		retun
	}

	saveStream( stream)
	startFlushing()
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
	// Perhaps we should try to open & stat the file & return a status basd on that?
	fileQueue.push( path)
	// no real reply offered in this demo server
	stream.end()

	// Make sure file queue is being run
	startFlushing()
}


var isRunning= false
async function startFlushing(){
	if( isRunning){
		// processing already began
		return
	}
	if( !fileQueue.length){
		return
	}
	for( var [session, pushStream] of pendingPushes){
		pushStreams.add( session, pushStream)
		pendingPushes.clear()
	}
	if( !pushStreams.length){
		return
	}

	// read first file
	var
	  name= fileQueue.shift(),
	  fd= await open( name, 'r'),
	  stat= await fstat( fd),
	  read= fs.createReadStream( null, { fd})

	// send file to tar entry
	++seq
	var entry= tar.entry({ name, size: stat.size})
	function finalize(){
		// finish this entry
		entry.end()
		// explicit gc
		entry= null
		read.removeAllListeners()

		// loop
		isRunning= false
		startFlushing() // do start flushing
	}
	read.on( "end", finalize)
	read.on( "data", entry.write.bind( entry))
}

tar.on( "data", function( data){
	for( var pushStream of pushStreams.values()){
		pushStream.write( data)
	}
})

server.listen(process.env.HTTZSTD_PORT|| process.env.NODE_PORT|| process.env.PORT, 80)
