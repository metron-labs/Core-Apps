var Client = require('node-rest-client').Client;
var client = new Client();

var accountSid,authToken,baseUrl,fromPhone;


function run(node) {
        var postArr = node.reqData.preData;
        var type = node.reqData.entity.type;
        var url = "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/";
        var obj;
        var resArr = [];
		for(var i = 0;i < postArr.length; i++) {
			obj = postArr[i];
			var postData = "";
			var message,toPhone;
			if(obj.hasOwnProperty("shippingAddress")) {
				toPhone = obj.shippingAddress.phone;
			} else {
				toPhone = obj.defaultAddress.phone;
			}
			if(type.toLowerCase() == "call") {
        		url += "Calls.json";
        		postData += encodeURIComponent(baseUrl)
			} else {
        		url += "Messages.json";
        		postData += "Body=" + encodeURIComponent(obj.message);
       		}
        	postData += "&From=" + encodeURIComponent(fromPhone) + "&To="+ encodeURIComponent(toPhone);
			var args = {
                data : postData,
                headers : {Authorization : "Basic " + b64EncodeUnicode(accountSid + ":" + authToken),Accept : "application/json", "Content-Type" : "application/x-www-form-urlencoded"}
            }; 
            client.post(url, args, function (data, res) {
                resArr[i] = data;
            }).on('error',function(err) {
                console.log('Something went wrong on the request', err.request.options);
            });
		}   
		post(resArr, node);    
    }
    
    function b64EncodeUnicode(str) {
        return new Buffer(str).toString('base64');
    }

    function post(resArr, node) {
		console.log("Twilio Response: %j", resArr);
        node.resData = resArr;
        //post req to the core server
    }

module.exports = (function () {
    var Twilio = {
        init: function (node) {
            //initial function to get request data
            var credentials = node.reqData.credentials;
           	accountSid = credentials[0];
            authToken = credentials[1];
            fromPhone = credentials[2];
            baseUrl = credentials[3];
            run(node);
        }   
    }
    return Twilio;
})();

