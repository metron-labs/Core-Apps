var Client = require('node-rest-client').Client;
var client = new Client();

// var emitter = require('../javascripts/emitter');

var apiKey, listId, baseUrl;

function run(node) {
    var obj = node.requestData;
    var firstName, lastName = '';
    var url = baseUrl + "/3.0/lists/" + listId + "/members";
    if(obj.hasOwnProperty("shippingAddress")) {
        firstName = obj.billingAddress.name;
    } else {
        firstName = obj.firstName;
        lastName = obj.lastName;
    }
    var postData = {
        email_address : obj.email,
        status : "subscribed",
        merge_fields : {
            FNAME : firstName,
            LNAME : lastName
        }
    };
    var args = {
        data : postData,
        headers : {
            "Authorization" : "apikey " + apiKey,
            "Accept" : "application/json",
            "Content-Type" : "application/json"
        }
    }; 
    client.post(url, args, function (data, res) {
        if(res.statusCode/100 == 2) {
            post(data, node);
        } else {
            var errMsg = 'Something went wrong on the request';
            var result = JSON.parse(data);
            if(result.hasOwnProperty("errors")) {
                errMsg = result.errors[0].message;
            } else {
                var detail = result.detail;
                errMsg = detail;
                if(detail.includes("already a list member")) {
                    var index = detail.indexOf('U');
                    errMsg = detail.substring(0, index);
                }                  
            } 
            console.log(errMsg);
            // emitter.emit('error',errMsg, args.data, url, node);
        }        
    }).on('error',function(err) {
        console.log('Something went wrong on the request', err.request.options);
        // emitter.emit('error','Something went wrong on the request', args.data, url, node);
    });
}

function post(res, node) {
    console.log("Mailchimp Response: %j", res);
    node.resData = res;
    // emitter.emit("success",node);
    //post req to the core server
}

function testApp() {
    var url = baseUrl + "/3.0/lists/" + listId + "/members";
    var args = {      
        headers : {
            "Authorization" : "apikey " + apiKey,
            "Accept" : "application/json",
        }
    };
    var result;
    client.get(url, args, function (data, res) {
        if(res.statusCode/100 == 2) {
           result = {
                status :'success',
                response: data
            };
        } else {
            var errMsg;
            var result = JSON.parse(data);
            if(result.hasOwnProperty("errors")) {
                errMsg = result.errors[0].message;
            } else {
                var detail = result.detail;
                errMsg = detail;                              
            } 
            result = {
                status :'error',
                response : errMsg
            };            
        }   
        console.log(result);
        return result;            
    }).on('error',function(err) {
       console.log('Something went wrong on the request', err.request.options);
    });

}

module.exports = (function () { 
    var Mailchimp = {
        init: function (node) {           
            //initial function to get request data
            var credentials = node.credentials;
            apiKey = credentials.apiKey;
            listId = credentials.listId;
            baseUrl = credentials.url;
            run(node);
        }, 
        test: function(request) {
            var credentials = request.credentials;
            apiKey = credentials.apiKey;
            listId = credentials.listId;
            baseUrl = credentials.url;
            testApp();
        }
    }
    return Mailchimp;
})();