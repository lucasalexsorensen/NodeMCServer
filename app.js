var app = require('http').createServer(handler)
, fs = require('fs')
, path = require('path')
, proc = require('child_process')
, servers = require('./servers')
, io = require('socket.io').listen(app)
, server = null
, mc_server = null;

app.listen(8080);

function handler(request, response){  
    var filePath = '.' + request.url;
    if (filePath == './')
        filePath = './index.html';
    var extname = path.extname(filePath);
    var contentType = 'text/html';
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
    }
    path.exists(filePath, function(exists) {   
        if (exists) {
            fs.readFile(filePath, function(error, content) {
                if (error) {
                    response.writeHead(500);
                    response.end();
                }
                else {
                    response.writeHead(200, { 'Content-Type': contentType });
                    response.end(content, 'utf-8');
                }
            });
        }
        else {
            response.writeHead(404);
            response.end();
        }
    });
     
}

io.sockets.on('connection', function (socket) {
	
	socket.on('get_server_list', function(){
		socket.emit('server_list', servers);
	});
	
	socket.on('debug', function(){
		socket.emit('server_granted', true)
	});
	
	socket.on('get_status', function(){
		socket.emit('status', server);
	});
	
	socket.on('start_server', function(name){
		console.log('Attempting to start server!');
		if(mc_server || !servers[name] || server){
			socket.emit('fail', 'start_server');
			socket.emit('server_granted', 'false');
			console.log('Server startup failed...');
			return;
		}
		server = name;
		
		mc_server = proc.spawn(
			"java",
			['-Xms1024M', '-Xmx1024M', '-jar', 'ftbserver.jar', 'nogui'],
			{ cwd: "C:/Users/LucasAlexander/Desktop/MCservers/"+servers[server] }
		);
		console.log('Server started!');
		io.sockets.emit('status', server);
		socket.emit('server_granted', true);
		
		mc_server.stdout.on('data', function(data){
			if(data){
				io.sockets.emit('console', ""+data);
			}
		});
		
		mc_server.stderr.on('data', function(data){
			if(data){
				io.sockets.emit('console', ""+data);
			}
		});
		
		mc_server.on('exit', function(){
			mc_server = server = null;
			io.sockets.emit('status', null);
		});
		
		mc_server.on('stop', function(){
			mc_server = server = null;
			io.sockets.emit('status', null);
		});
	});
	
	socket.on('command', function(cmd){
		if(mc_server){
			io.sockets.emit('console', "COMMAND: "+cmd);
			mc_server.stdin.write(cmd + "\r");
		}else{
			socket.emit('fail', cmd);
		}
	});
	
});

process.stdin.resume();
process.stdin.on('data', function(data){
	if (mc_server){
		mc_server.stdin.write(data);
	}
});