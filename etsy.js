var OAuth=require('oauth').OAuth;
var async = require('async');
var Client = require('node-rest-client').Client;
var client = new Client();

// var emitter = require('../javascripts/emitter');

var consumerKey, consumerSecret, token, tokenSecret, shopId;
var page = 1;
var arrayLength = 0;
var finalDataArr = [];
var countries = [];
var errMsg = 'Something went wrong on the request';
var baseUrl = 'https://openapi.etsy.com/v2/';

function run(node) {
	var requestUrl =  "https://openapi.etsy.com/v2/oauth/request_token";
	var authorizeUrl = "https://www.etsy.com/oauth/signin";
	var oauth = new OAuth(requestUrl,authorizeUrl,consumerKey,consumerSecret, "1.0", null,
		"HMAC-SHA1", null, {Accept : "application/json"} );
	var url = baseUrl + 'countries';
	oauth.get(url, token, tokenSecret, function(err, data, res) {
		if(err) {
			console.log(err);
			// emitter.emit("error", err, "", url, node);
		} else {			
			var response = JSON.parse(data);
			var obj, resObj;
			for(var i = 0; i < response.results.length; i++) {
				obj = response.results[i];				
				resObj = {};
				resObj.id = obj.country_id;
				resObj.name = obj.iso_country_code;
				countries[i] = resObj;				
				if(i == response.results.length-1){
					getStoreData(oauth, node);
				}
			}
		}
	});

}

function getStoreData(oauth, node) {
	var url =baseUrl + 'shops/' + shopId + '/receipts?page=' + page + '&limit=10';		
	oauth.get(url, token, tokenSecret, function(err, data, res) {
		if(err){
			console.log('error..........', err);
			// emitter.emit("error", err, "", url, node);
		} else {
			var result = JSON.parse(data);
			page = result.pagination.next_page;
			arrayLength = result.count;
			formOrder(result.results, oauth, node);							
		}
	});
}

function formOrder(dataArr, oauth, node) {
	var resArr = [];
	var obj, resObj;	
	for(var i = 0; i < dataArr.length; i++) {
		resObj = {};
		obj = dataArr[i];
		resObj.id = obj.order_id;
		resObj.name = obj.receipt_id;
		resObj.email = obj.buyer_email;
		resObj.price = obj.total_price;
		var date = new Date(0);
		date.setUTCSeconds(obj.creation_tsz);
		resObj.createdAt = date;
		date = new Date(0);
		date.setUTCSeconds(obj.last_modified_tsz);
		resObj.updatedAt = date;
		resObj.customerId = obj.buyer_user_id;
		resObj.customerName = obj.name;
		var status = 'pending';
		if(obj.was_paid) {
			status = 'paid';
		}
		if(obj.was_shipped) {
			status = 'shipped';
		}
		var billAddr = {};
		billAddr.name = obj.name;
		billAddr.street = obj.first_line;
		billAddr.city = obj.city;
		billAddr.state = obj.state;
		var id = obj.country_id;
		var country = '';
		for(var j = 0; j < countries.length; j++) {
			var countryObj = countries[j];
			if(id == countryObj.id) {
				country = countryObj.name;
			}
		}
		billAddr.country = country;
		resObj.billingAddress = billAddr;
		resObj.shippingAddress = billAddr;
		resArr[i] = resObj;		
	}	
	getItems(resArr, oauth, node);
}

function getItems(dataArr, oauth, node) {
	var length = dataArr.length;
	var items = [];	
	async.forEach(dataArr, function(obj) {		
		var url = baseUrl +  'receipts/' + obj.name + '/transactions';		
		oauth.get(url, token, tokenSecret, function(err, data, res) {
			if(err) { 				
				console.log('error..........',err);
				length--;
				// emitter.emit("error", err, "", url, node);
			} else {						
				var quantity = 0;						
				var response = JSON.parse(data);
				var itemArr = response.results;
				var itemObj, item;				
				for(var i = 0; i < itemArr.length; i++) {
					itemObj = itemArr[i];
					item = {};
					item.id = itemObj.listing_id;
					item.name = itemObj.title;
					item.price = itemObj.price;
					item. quantity = itemObj.quantity;
					items[i] = item;
					quantity += itemObj.quantity;
				}
				obj.items = items;
				obj.name = obj.id;
				obj.quantity = quantity;
				length--;						
				if(length == 0) {
					concatResult(dataArr, oauth, node);
				}
			}
		});		
	}, function(error) {
		console.log('error...........',error);
		// emitter.emit("error", err, "", "", node);
	});
}

function concatResult(dataArr, oauth, node) {
	finalDataArr = finalDataArr.concat(dataArr);
	if(finalDataArr.length == arrayLength) {
		post(finalDataArr, node);
	} else {
		if(page != null) {
			getStoreData(oauth, node);
		}
	}
}

function post(response, node) {
	console.log('Ending Time......', new Date().toUTCString());
	console.log('Etsy Response: %j', response[0]);
	node.resData = response;
	// emitter.emit('success', node);
}

function testApp() {
	var requestUrl =  "https://openapi.etsy.com/v2/oauth/request_token";
	var authorizeUrl = "https://www.etsy.com/oauth/signin";
	var oauth = new OAuth(requestUrl,authorizeUrl,consumerKey,consumerSecret, "1.0", null,
		"HMAC-SHA1", null, {Accept : "application/json"} );
	var url = 'https://openapi.etsy.com/v2/shops/' + shopId + '/receipts?page=1&limit=1';
	console.log(url);
	var result;
	oauth.get(url, token, tokenSecret, function(err, data, res) {
		if(err){
			result = {
				status : 'error',
				response : data
			};
		} else {
			result = {
				status : 'success',
				response : data
			};
		}
		console.log("Result: ", result);
		return result;
	});
}

module.exports = (function() {
	var Etsy = {
		init: function(node) {
			var credentials = node.credentials;
			consumerKey = credentials.consumerKey;
			consumerSecret = credentials.consumerSecret;
			token = credentials.token;
			tokenSecret = credentials.tokenSecret;
			shopId = credentials.shopId;
			run(node);
		}, 
		test: function(request) {
			var credentials = request.credentials;
			consumerKey = credentials.consumerKey;
			consumerSecret = credentials.consumerSecret;
			token = credentials.token;
			tokenSecret = credentials.tokenSecret;
			shopId = credentials.shopId;
			testApp();
		}
	};
	return Etsy;
})();