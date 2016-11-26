var Client = require('node-rest-client').Client;
var client = new Client();

var apiKey;

function run(node) {
	var postArr = node.resData;
	var type = node.reqData.entity.type;
	var obj;
	var resArr = [];
	for(var i = 0; i < postArr.length; i++) {
		obj = postArr[i];
		var url = "https://person-stream.clearbit.com/v2/combined/find?email=" + obj.email;
		var args = {
			headers:{Authorization : "Bearer " + apiKey, Accept : "application/json" }
		};
		client.get(url,args,function(data,res) {
			resArr[i] = data;
		}).on('error',function(err) {
			console.log("Something went wrong on the request", err.request.options);
		});
		post(resArr,node);
	}
}

function b64EncodeUnicode(str) {
    return new Buffer(str).toString('base64');
}

function post(resArr, nde) {
	console.log(" Clearbit Response: %j",resArr);
    node.resData = resArr;
    //post req to the core server
}

module.exports = (function() {
	var Clearbit = {
        init: function (node) {
            //initial function to get request data
            var credentials = node.reqData.credentials;
            apiKey = credentials[0];
            run(node);
        }   
    }
    return Clearbit;
})();