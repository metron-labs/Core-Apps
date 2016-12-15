var Client = require('node-rest-client').Client;
var async = require('async');
var client = new Client();

var OAuth = require('oauth').OAuth2;

// var emitter = require('../javascripts/emitter');

var sfAccessToken, baseUrl, userName,password, clientId, clientSecret, securityToken;
var errMsg = 'Something went wrong on the request';

function run(node) {
	var type = node.connection.option;
	var nodeType = node.connector.type;
	var url = "https://login.salesforce.com/services/oauth2/token";
	var postData = "grant_type=password&username=" + encodeURIComponent(userName) 
		+ "&password=" + password + securityToken + "&client_id="
		+ clientId + "&client_secret=" + clientSecret;
	var args = {
		data : postData,
		headers : { "Content-Type":"application/x-www-form-urlencoded"}
	};	
	client.post(url, args, function(data, res) {
		var status = parseInt(res.statusCode/100);
		if(status == 2) {
			sfAccessToken = data.access_token;
			baseUrl = data.instance_url;
			if(nodeType.toLowerCase() == "trigger") {
				getObjects(type, node);
			} else {
				postAction(type, node);
			}
		} else {
			if(data.hasOwnProperty("error_description")) {
				errMsg = data.error_description;
			} else if(data[0].hasOwnProperty("message"))
			{
				errMsg = data[0].message;
			}
			console.log(errMsg);
			// emitter.emit('error',errMsg,args.data, url,node);
		}				
	}).on('error', function(err) {
		console.log(errMsg, err.request.options);
		// emitter.emit('error',errMsg,args.data, url, node);
	});
}	

function getObjects(type, node) {
	var url = baseUrl + "/services/data/v34.0/sobjects/" + type;
	var args = {
		headers : { Authorization :"Bearer " + sfAccessToken, Accept : "application/json"}
	};
	client.get(url, args, function(data, res) {
		var status = parseInt(res.statusCode/100);
		if(status == 2) {
			getObjectDetails(data.recentItems, type, node);
		} else {
			var result = data;
			if(result[0].hasOwnProperty("message")) {
				errMsg = result[0].message;
			}
			console.log(errMsg);
			// emitter.emit('error',errMsg,"", url, node);
		}		
	}).on('error', function(err) {
		console.log(errMsg, err.request.options);
		// emitter.emit('error',errMsg,"", url, node);
	});
}

function getObjectDetails(dataArr, type, node) {
	var url = baseUrl + "/services/data/v34.0/sobjects/" + type;
	var args = {
		headers : { Authorization :"Bearer " + sfAccessToken, Accept : "application/json"}
	};
	var obj;
	var resArr = [];
	var i = 0;
	if(dataArr.length == 0) {
		console.log('There is no records in %j',type);
		errMsg = 'There is no records in '+ type;
		// emitter.emit('error',errMsg,"", "",node);
	} else {
		var length = dataArr.length;
		async.forEach(dataArr, function(obj){
			var newUrl = url + "/" + obj.Id;
			client.get(newUrl, args, function(data, res) {
				var status = parseInt(res.statusCode/100);
				if( status == 2) {
					resArr[i] = data;
					i++;
					length--;
					if(length == 0) {
						if(type.toLowerCase() == "account") {
							formCustomerFromAccount(resArr, node);
						} else {
							formCustomer(resArr, type, node);
						}
					}														
				} else {
					console.log(errMsg);
					// emitter.emit('error',errMsg,"", newUrl, node);
				}	 
			}).on('error', function(err){
				console.log(errMsg,err.request.options);
				// emitter.emit('error',errMsg,"", newUrl, node);
			});
		}, function(error) {
		console.log("Some error has occured %j",error);
		// emitter.emit('error',error,"","",node);
		});	
	}
}

function formCustomer(dataArr, type, node) {
	var resArr = [];
	var obj, resObj;
	for(var i = 0; i < dataArr.length; i++) {
		resObj = {};
		obj = dataArr[i];
		resObj.id = obj.Id;
		resObj.firstName = obj.FirstName;
		resObj.lastName = obj.LastName;
		resObj.email = obj.Email;
		resObj.createdAt = obj.CreatedDate;
		resObj.updatedAt = obj.LastModifiedDate;
		resObj.title = obj.Title;
		var addr1 = {};
		addr1.phone = obj.Phone;
		if(type.toLowerCase() == "lead") {
			addr1.company = obj.Company;
			addr1.street = obj.Street;
			addr1.city = obj.City;
			addr1.state = obj.State;
			addr1.country = obj.Country;
			addr1.zip = obj.PostalCode;
		} else {
			addr1.street = obj.MailingStreet;
			addr1.city = obj.MailingCity;
			addr1.state = obj.MailingState;
			addr1.country = obj.MailingCountry;
			addr1.zip = obj.MailingPostalCode;
		}
		resObj.defaultAddress = addr1;
		resArr[i] = resObj;
	}
	post(resArr, node);
}

function formCustomerFromAccount(dataArr, node) {
	var obj, resObj;
	var resArr = [];
	for(var i = 0; i < dataArr.length; i++) {
		resObj = {};
		obj = dataArr[i];
		resObj.id = obj.Id;
		resObj.firstName = obj.Customer_Name__c;
		resObj.email = obj.Email__c;
		resObj.createdAt = obj.CreatedDate;
		resObj.updatedAt = obj.LastModifiedDate;
		var addr1 = {};
		addr1.phone = obj.Phone;
		addr1.street = obj.BillingStreet;
		addr1.city = obj.BillingCity;
		addr1.state = obj.BillingState;
		addr1.country = obj.BillingCountry;
		addr1.zip = obj.BillingPostalCode;
		resObj.defaultAddress = addr1;
		resArr[i] = resObj;
	}
	post(resArr, node);
}

function postAction(type, node) {
	var obj = node.requestData;
	if(type.toLowerCase() == "account") {
		postAccount(obj, node);
	} else if(type.toLowerCase() == "lead") {
		postLead(obj, node);
	} else {
		postContact(obj, node);
	}
}

function postLead(obj, node) {
	var newUrl = baseUrl + "/services/data/v34.0/sobjects/Lead/";
	var name, phone, company, street, city, state, country,zip;
	var query = "SELECT+Id+FROM+Lead+WHERE+Email+=+'" + obj.email + "'";
	var url = baseUrl + "/services/data/v34.0/query?q=" + query;
	var lastName = '-';
	if(obj.hasOwnProperty("shippingAddress")) {
		name = obj.billingAddress.name;
		phone = obj.billingAddress.phone;
		company = obj.billingAddress.company;
		street = obj.billingAddress.street;
		city = obj.billingAddress.city;
		state = obj.billingAddress.state;
		country = obj.billingAddress.country;
		zip = obj.billingAddress.zip;
	} else {
		name = obj.firstName;
		phone = obj.defaultAddress.phone;
		company = obj.defaultAddress.company
		street = obj.defaultAddress.street;
		city = obj.defaultAddress.city;
		state = obj.defaultAddress.state;
		country = obj.defaultAddress.country;
		zip = obj.defaultAddress.zip;
	}
	var getArgs = {
		headers : { 
			Authorization :"Bearer " + sfAccessToken,
			Accept : "application/json"
		}
	};
	if(obj.hasOwnProperty("lastName") && obj.lastName != null && obj.lastName == '') {
		lastName = obj.lastName;
	}
	var postData = {
		FirstName : name,
		LastName : lastName,
		Email : obj.email,
		Phone : phone,
		Company : company,
		Street : street,
		City : city,
		State : state,
		Country : country,
		PostalCode : zip,
	};
	var postArgs = {
		data : postData,
		headers : { 
			Authorization :"Bearer " + sfAccessToken,
			Accept : "application/json",
			"Content-Type" : "application/json"
		}
	};
	client.get(url, getArgs, function(data, res) {
		var status = parseInt(res.statusCode/100);
		if(status == 2) {
			if(data.hasOwnProperty('records')) {
				var records = data.records;
				if(!records.length == 0) {
					var id = records[0].Id;
					newUrl += id + "?_HttpMethod=PATCH";
				}
			}
			client.post(newUrl,postArgs, function(data1, res1) {
				var status1 = parseInt(res1.statusCode/100);
				if(status1 == 2) {
					post(data1, node);
				} else {
					if(data1[0].hasOwnProperty("message")) {
						errMsg = data1[0].message;
					}
					console.log(errMsg);
					// emitter.emit('error',errMsg,postArgs.data, newUrl, node);
				}					
			}).on('error',function(err1) {
				console.log(errMsg, err1.request.options);
				// emitter.emit('error',errMsg,postArgs.data, newUrl, node);
			});
		} else {
			if(data[0].hasOwnProperty("message")) {
				errMsg = data[0].message;
			}
			console.log(errMsg, res.statusCode);
			// emitter.emit('error',errMsg,"",url,node);
		}			
	}).on('error', function(err) {
		console.log(errMsg,err.request.options);
		// emitter.emit('error',errMsg,"",url,node);
	});
}

function postAccount(obj, node) {
	var  obj = node.requestData;	
	var query = "SELECT Email__c,Id from Account WHERE Email__c in ('" + obj.email + "')";
	var url = baseUrl + "/services/data/v34.0/query?q=" + encodeURIComponent(query);
	var newUrl = baseUrl + "/services/data/v34.0/sobjects/Account/";
	var getArgs = {
		headers : { Authorization : "Bearer " + sfAccessToken, Accept : "application/json"}
	};
	var name, shippingStreet, shippingCity, shippingState, shippingCountry, shippingZip;
	var billingStreet, billingCity, billingState, billingCountry, billingZip;
	if(obj.hasOwnProperty("shippingAddress")) {
		name = obj.billingAddress.name;
		billingStreet = obj.billingAddress.street;
		billingCity = obj.billingAddress.city;
		billingState = obj.billingAddress.state;
		billingCountry = obj.billingAddress.country;
		billingZip = obj.billingAddress.zip;
		shippingStreet = obj.shippingAddress.street;
		shippingCity = obj.shippingAddress.city;
		shippingState = obj.shippingAddress.state;
		shippingCountry = obj.shippingAddress.country;
		shippingZip = obj.shippingAddress.zip;
	} else {
		name = obj.firstName;
		billingStreet = obj.defaultAddress.street;
		billingCity = obj.defaultAddress.city;
		billingState = obj.defaultAddress.state;
		billingCountry = obj.defaultAddress.country;
		billingZip = obj.defaultAddress.zip;
		shippingStreet = obj.defaultAddress.street;
		shippingCity = obj.defaultAddress.city;
		shippingState = obj.defaultAddress.state;
		shippingCountry = obj.defaultAddress.country;
		shippingZip = obj.defaultAddress.zip;
	}
	var postData = {
		Name : name,
		Customer_Name__c : name,
		Email__c : obj.email,
		ShippingStreet : shippingStreet,
		ShippingCity : shippingCity,
		ShippingState : shippingState,
		ShippingCountry : shippingCountry,
		ShippingPostalCode : shippingZip,
		BillingStreet : billingStreet,
		BillingCity : billingCity,
		BillingState : billingState,
		BillingCountry : billingCountry,
		BillingPostalCode : billingZip
	};
	var postArgs = {
		data : postData,
		headers : { 
			Authorization : "Bearer " + sfAccessToken,
			Accept : "application/json",
			"Content-Type" : "application/json"
		}
	};
	client.get(url,getArgs,function(data, res) {
		var status = parseInt(res.statusCode/100);
		if(status == 2) {
			if(data.hasOwnProperty("totalSize")) {
				var totalSize = data.totalSize;				
				if(totalSize > 0) {
					var records = data.records;
					var attributues = records[0];
					var id = attributues.Id;
					newUrl += id + "?_HttpMethod=PATCH";
				}
			}
			client.post(newUrl,postArgs, function(data1, res1) {
				var status1 = parseInt(res1.statusCode/100);
				if(status1 == 2) {
					post(data1, node);
				} else {
					if(data1[0].hasOwnProperty("message")) {
						errMsg = data1[0].message;
					}
					console.log(errMsg);
					// emitter.emit('error',errMsg,postArgs.data,newUrl,node);
				}
			}).on('error',function(err1) {
				console.log(errMsg, err1.request.options);
				// emitter.emit('error',errMsg,postArgs.data,newUrl,node);
			});
		} else {
			if(data[0].hasOwnProperty("message")) {
				errMsg = data[0].message;
			}
			console.log(errMsg);
			// emitter.emit('error',errMsg,"",url,node);
		}			
	}).on('error', function(err) {
		console.log(errMsg,err.request.options);
		// emitter.emit('error',errMsg,"",url,node);
	});
}	

function postContact(obj, node) {
	var query = "SELECT+Id+FROM+Contact+WHERE+Email+=+'" + obj.email + "'";
	var url = baseUrl + "/services/data/v34.0/query?q=" + query;
	var newUrl = baseUrl + "/services/data/v34.0/sobjects/Contact/";
	var getArgs = {
		headers : { Authorization : "Bearer " + sfAccessToken, Accept : "application/json"}
	};
	var lastName = '-';
	if(obj.hasOwnProperty("shippingAddress")) {
		name = obj.billingAddress.name;
		phone = obj.billingAddress.phone;
		company = obj.billingAddress.company;
		street = obj.billingAddress.street;
		city = obj.billingAddress.city;
		state = obj.billingAddress.state;
		country = obj.billingAddress.country;
		zip = obj.billingAddress.zip;
	} else {
		name = obj.firstName;
		phone = obj.defaultAddress.phone;
		company = obj.defaultAddress.company
		street = obj.defaultAddress.street;
		city = obj.defaultAddress.city;
		state = obj.defaultAddress.state;
		country = obj.defaultAddress.country;
		zip = obj.defaultAddress.zip;
	}
	if(obj.hasOwnProperty("lastName") && obj.lastName != null && obj.lastName == '') {
		lastName = obj.lastName;
	}
	var postData = {
		FirstName : name,
		LastName : lastName,
		Email : obj.email,
		MailingStreet : street,
		MailingCity : city,
		MailingState : state,
		MailingCountry : country,
		MailingPostalCode : zip,
		Type__c : "Customer"
	};		
	var postArgs = {
		data : postData,
		headers : { 
			Authorization : "Bearer " + sfAccessToken,
			Accept : "application/json",
			"Content-Type" : "application/json"
		}
	};
	client.get(url, getArgs, function(data, res) {
		var status = parseInt(res.statusCode/100);
		if(status == 2) {
			if(data.hasOwnProperty('records')) {
				var records = data.records;
				if(!records.length == 0) {
					var id = records[0].Id;
					newUrl += id + "?_HttpMethod=PATCH";
				}
			}
			client.post(newUrl,postArgs, function(data1, res1) {
				var status1 = parseInt(res1.statusCode/100);
				if(status1 == 2) {
					post(data1, node);
				} else {
					if(data1[0].hasOwnProperty("message")) {
						errMsg = data1[0].message;
					}
					console.log(errMsg);
					// emitter.emit('error',errMsg, postArgs.data, newUrl, node);
				}
			}).on('error',function(err1) {
				console.log(errMsg, err1.request.options);
				// emitter.emit('error',errMsg,postArgs.data, newUrl, node);
			});
		} else {
			if(data[0].hasOwnProperty("message")) {
				errMsg = data[0].message;
			}
			console.log(errMsg);
			// emitter.emit('error',errMsg,"",url, node);
		}
	}).on('error', function(err) {
		console.log(errMsg,err.request.options);
		// emitter.emit('error',errMsg,"",url, node);
	});
}

function post(response, node) {
	console.log('SalesForce Response: %j', response);
	node.resData = response;
	// emitter.emit('success',node);
}

function testApp() {
	var url = "https://login.salesforce.com/services/oauth2/token";
	var postData = "grant_type=password&username=" + encodeURIComponent(userName) 
		+ "&password=" + password + securityToken + "&client_id="
		+ clientId + "&client_secret=" + clientSecret;
	var args = {
		data : postData,
		headers : { "Content-Type":"application/x-www-form-urlencoded"}
	};
	var result;	
	client.post(url, args, function(data, res) {
		var status = parseInt(res.statusCode/100);
		if(status == 2) {
			result = {
                status :'success',
                response: data
            };
		} else {
			if(data.hasOwnProperty("error_description")) {
				errMsg = data.error_description;
			} else if(data[0].hasOwnProperty("message"))
			{
				errMsg = data[0].message;
			}
			result = {
                status :'error',
                response: errMsg
            };			
		}	
		console.log(result);
        return result; 			
	}).on('error', function(err) {
		console.log(errMsg, err.request.options);		
	});
}

module.exports = (function(){
	var SalesForce = {
		init: function(node) {
			var credentials = node.credentials;
			clientId = credentials.clientId;
			clientSecret = credentials.clientSecret;
			userName = credentials.userName;
			password = credentials.password;
			securityToken = credentials.securityToken;
			run(node);
		},
		test: function(request) {
			var credentials = request.credentials;
			clientId = credentials.clientId;
			clientSecret = credentials.clientSecret;
			userName = credentials.userName;
			password = credentials.password;
			securityToken = credentials.securityToken;
			testApp();
		}
	};
	return SalesForce;
})();