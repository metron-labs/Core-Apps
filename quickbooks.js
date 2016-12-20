var OAuth=require('oauth').OAuth;
var Client = require('node-rest-client').Client;
var client = new Client();

var emitter = require('../core-integration-server-v2/javascripts/emitter');

var apiKey, consumerSecret, apiPassword, tokenSecret, accountType, companyId, url,
	incomeAccNo, incomeAccName, expenseAccNo, expenseAccName, assetAccNo, assetAccName;
var errMsg = 'Something went wrong on the request';

function run(node) {
	var requestUrl = "https://oauth.intuit.com/oauth/v1/get_request_token";
	var authorizeUrl = "https://appcenter.intuit.com/Connect/Begin";
	var type = node.connection.option;
	var nodeType = node.connector.type;
	if(accountType.toLowerCase() == "sandbox") {
		url = "https://sandbox-quickbooks.api.intuit.com/v3/company/";
	} else {
		url = "https://quickbooks.api.intuit.com/v3/company/";
	}
	oauth= new OAuth(requestUrl, authorizeUrl, apiKey, consumerSecret, "1.0", null,
		"HMAC-SHA1", null, {Accept : "application/json"} );
	if(nodeType.toLowerCase() == "trigger") {
		getStoreData(url, type, oauth, node);
	} else {
		postAction(url, type, oauth, node);
	}
}

function getStoreData(url, type, oauth, node) {
	var query;
	if(type.toLowerCase() == "customer") {
		query = "select * from customer";
	} else if(type.toLowerCase() == "salesreceipt") {
		query = "select * from salesreceipt";
	} else if(type.toLowerCase() == "invoice") {
		query = "select 8 from invoice";
	} else {
		query = "select * from Item";
	}
	url += companyId + "/query?query=" + encodeURIComponent(query);
	oauth.get(url,apiPassword,tokenSecret,function(err,data,res) {
		if(err) {
			console.log(errMsg,err);
			// emitter.emit("error",errMsg, "", node);
		} else {
			formDataModel(data,type,node);
		}
	});
}

function formDataModel(data, type, node) {	
	var res = JSON.parse(data);	
	var dataArr = [];	
	if(type.toLowerCase() == "customer") {
		dataArr = res.QueryResponse.Customer;
		formCustomer(dataArr, node);
	} else if(type.toLowerCase() == "salesreceipt") {
		dataArr = res.QueryResponse.SalesReceipt;
		formOrder(dataArr, node);
	} else if(type.toLowerCase() == "invoice") {
		dataArr = res.QueryResponse.Invoice;
		formOrder(dataArr, node);
	} else {
		dataArr = res.QueryResponse.Item;
		formProduct(dataArr,node);
	}
}

function formCustomer(dataArr, node) {
	var resArr = [];
	var obj,resObj;
	var lastName = phone = company = street = city = state = country = '';
	if(dataArr.length == 0) {
		errMsg = 'No data found in Quickbooks';
		console.log(errMsg);
		// emitter.emit('error',errMsg, "","", node);
	}
	for(var i = 0; i < dataArr.length; i++) {
		resObj = {};
		obj = dataArr[i];
		if(obj.hasOwnProperty("MiddleName")) {
			lastName = obj.MiddleName;
		}
		resObj.name = obj.FullyQualifiedName;
		resObj.firstName = obj.GivenName;
		resObj.lastName = lastName;
		resObj.createdAt = obj.MetaData[0];
		resObj.updatedAt = obj.MetaData[1];
		resObj.email = obj.PrimaryEmailAddr.Address;
		var addr1 = {};
		addr1.firstName = obj.GivenName;
		addr1.lastName = lastName;
		if(obj.hasOwnProperty("BillAddr")) {
			street = obj.BillAddr.Line1;
			city = obj.BillAddr.City;
			country = obj.BillAddr.Country;
			state = obj.BillAddr.CountrySubDivisionCode;
			zip = obj.BillAddr.PostalCode;
		}
		addr1.street = street;
		addr1.city = city;
		addr1.country = country;
		addr1.state = state;
		addr1.zip = zip;
		if(obj.hasOwnProperty("PrimaryPhone")) {
			phone = obj.PrimaryPhone.FreeFormNumber;
		}
		addr1.phone = phone;
		if(obj.hasOwnProperty("CompanyName")) {
			company = obj.CompanyName;
		}
		addr1.company = company;
		resObj.defaultAddress = addr1;
		resArr[i] = resObj;		
	}
	post(resArr, node);
}

function formProduct(dataArr, node) {
	var resArr = [];
	var obj,resObj;
	var sku = '';
	var qtyOnHand = '';
	if(dataArr.length == 0) {
		errMsg = 'No data found in Quickbooks';
		console.log(errMsg);
		// emitter.emit('error',errMsg, "","", node);
	}
	for(var i = 0; i < dataArr.length; i++) {
		resObj = {};
		obj = dataArr[i];
		resObj.id = obj.Id;
		resObj.name = obj.Name;
		resObj.price = obj.UnitPrice;
		resObj.createdAt = obj.MetaData[0];
		resObj.updatedAt = obj.MetaData[1];
		if(obj.hasOwnProperty("Sku")){
			sku = obj.Sku;
		}
		resObj.sku = sku;
		if(obj.hasOwnProperty("QtyOnHand")) { 
			qtyOnHand = obj.QtyOnHand;
		}
		resObj.qtyOnHand = qtyOnHand;
		resArr[i] = resObj;		
	}
	post(resArr, node);
}

function formOrder(dataArr, node) {
	var resArr = [];
	var obj,resObj;
	var email = '';
	if(dataArr.length == 0) {
		errMsg = 'No data found in Quickbooks';
		console.log(errMsg);
		// emitter.emit('error',errMsg, "","", node);
	}
	for(var i = 0; i < dataArr.length; i++) {
		resObj = {};
		obj = dataArr[i];
		resObj.id = obj.Id;
		resObj.name = obj.DocNumber;
		if(obj.hasOwnProperty("BillEmail")) {
			email = obj.BillEmail.Address
		}
		resObj.email = email;
		resObj.price = obj.TotalAmt;
		resObj.createdAt = obj.MetaData[0];
		resObj.updatedAt = obj.MetaData[1];
		resObj.customerId = obj.CustomerRef.value;
		resObj.customerName = obj.CustomerRef.name;
		var billAddr = {};
		billAddr.name = obj.CustomerRef.name;
		billAddr.street = obj.BillAddr.Line1;
		billAddr.city = obj.BillAddr.City;
		billAddr.state = obj.BillAddr.CountrySubDivisionCode;
		billAddr.country = obj.BillAddr.Country;
		billAddr.zip = obj.BillAddr.PostalCode;
		resObj.billingAddress = billAddr;
		var shipAddr = {};
		shipAddr.name = obj.CustomerRef.name;
		shipAddr.street = obj.ShipAddr.Line1;
		shipAddr.city = obj.ShipAddr.City;
		shipAddr.state = obj.ShipAddr.CountrySubDivisionCode;
		shipAddr.country = obj.ShipAddr.Country;
		shipAddr.zip = obj.ShipAddr.PostalCode;
		resObj.shippingAddress = shipAddr;
		var prod,item;
		var itemArr = [];
		var prodArr = obj.Line;
		var quantity = '';
		for(var j = 0; j < prodArr.length-1; j++) {
			item = {};
			prod = prodArr[j];
			var itemDetail = prod.SalesItemLineDetail; 
			var qty = itemDetail.Qty;
			item.id = itemDetail.ItemRef.value;
			item.name = itemDetail.ItemRef.name;
			quantity += qty;
			var price = prod.Amount/qty;
			item.price = price;
			itemArr[j] = item;
		}
		resObj.items = itemArr;
		resObj.quantity = quantity;
		var balance = obj.Balance;
		var status = "pending";
		if(balance == 0) {
			status = "paid";
		}
		resObj.status = status;
		resArr[i] = resObj;
	}
	post(resArr, node);
}

function postAction(url, type, oauth, node) {
	if(type.toLowerCase() == "customer") {
		postCustomer(url, oauth, node);
	} else if(type.toLowerCase() == "product") {
		postProduct(url, oauth, node);
	} else {
		postInvoiceOrSalesReceipt(url,type, oauth, node);
	}
}

function postCustomer(url,  oauth, node) {
	url += companyId + "/customer";
	var resArr = [];
	var obj = node.requestData;	
	var postData = {
		GivenName : obj.firstName,
		MiddleName : obj.lastName,
		PrimaryEmailAddr : { Address : obj.email },
		PrimaryPhone : { FreeFormNumber : obj.defaultAddress.phone },
		BillAddr : { Line1 : obj.defaultAddress.street,
			City : obj.defaultAddress.city,
			Country : obj.defaultAddress.country,
			CountrySubDivisionCode : obj.defaultAddress.state,
			PostalCode : obj.defaultAddress.zip 
		}
	};
	var Params = oauth._prepareParameters(apiPassword,tokenSecret,"POST",url);
	var auth = oauth._buildAuthorizationHeaders(Params);
	var args = {
		data:postData,
		headers : {Authorization: auth,Accept: "application/json","Content-Type":"application/json"}
	};
	client.post(url, args, function (data, res) {
		var status = parseInt(res.statusCode/100);
		if(status == 2){
			post(data, node);
		} else {
			console.log(errMsg, res.statusCode);
			// emitter.emit('error',errMsg, args.data, url, node);
		}            
    }).on('error',function(err) {
        console.log(errMsg, err.request.options);
//			emitter.emit('error',errMsg, args.data, url, node);
	});
}	

function postProduct(url, oauth, node) {
	url += companyId + "/item";
	var resArr = [];
	var obj = node.requestData;
	postData = {
		Name: obj.name,
		UnitPrice: obj.price,
		Sku: obj.sku,
		IncomeAccountRef: {value: incomeAccNo, name:incomeAccName },
		ExpenseAccountRef: {value: expenseAccNo , name: expenseAccName },
		AssetAccountRef: {value: assetAccNo,name: assetAccName},
		Type: "Inventory",
		TrackQtyOnHand: true,
		QtyOnHand:obj.qtyOnHand ,
		InvStartDate: new Date()
	};
	var Params = oauth._prepareParameters(apiPassword,tokenSecret,"POST",url);
	var auth = oauth._buildAuthorizationHeaders(Params);
	var args = {
		data:postData,
		headers : {Authorization: auth,Accept: "application/json","Content-Type":"application/json"}
	};
	client.post(url, args, function (data, res) {
		var status = parseInt(res.statusCode/100);
    	if(status == 2){
			post(data, node);
		} else {
			console.log(errMsg, res.statusCode);
			// emitter.emit('error',errMsg, args.data, url, node);
		}  
    }).on('error',function(err) {
        console.log(errMsg, err.request.options);
      //  emiitter.emit("error",errMsg, args.data, url, node);
	});
}

function postInvoiceOrSalesReceipt(url, type, oauth, node) {
	var lineArr = [];	
	var newUrl = url + companyId + "/" + type.toLowerCase();
	var obj = node.requestData;
	var postData,lineObj;	
	var items = obj.items;			
	getCustomerId(url, oauth, obj, function(cusRef){
		for(var j = 0; j < items.length; j++) {
			lineObj = {};
			var item = items[j];
			getItemId(url, oauth, item,function(id){
				for(var k = 0; k < items.length; k++) {
					lineObj.Amount =  (item.price * item.quantity );
					lineObj.DetailType = "SalesItemLineDetail";
					var salesILD = {};
					var	itemRef = {};
					itemRef.value =id;
					itemRef.name = item.name;
					salesILD.ItemRef = itemRef;
					salesILD.Qty = item.quantity;
					lineObj.SalesItemLineDetail = salesILD;
					lineArr[k] = lineObj;
					postData = { Line: lineArr,CustomerRef: cusRef};
					var Params = oauth._prepareParameters(apiPassword,tokenSecret,"POST",newUrl);
					var auth = oauth._buildAuthorizationHeaders(Params);
					var args = {
						data: postData,
						headers : {Authorization: auth,Accept: "application/json","Content-Type":"application/json"}
					};
					client.post(newUrl, args, function (data, res) {
						var status = parseInt(res.statusCode/100);
						if(status == 2){
	            				post(data, node);
	            		} else {
							console.log(errMsg, res.statusCode);
							// emitter.emit('error',errMsg, args.data, newUrl, node);
						}  	            			
    				}).on('error',function(err) {
        				console.log(errMsg, err.request.options);
        				//emitter.emit('error',errMsg, args.data, newUrl, node);
					});
				}			
			});		
		}
	});					
}

function getCustomerId(url, oauth, obj,callback) {
	var customerRef = {};
	var query = "select * from customer where DisplayName in ('" + obj.customerName +"')";
	newUrl = url + companyId + "/query?query= "+encodeURIComponent(query);
	oauth.get(newUrl, apiPassword, tokenSecret, function(err, data, res) {
		if(err) {
			console.log(errMsg,err);
		//	emitter.emit('error',errMsg, "", newUrl, node);
		} else {
			var result = JSON.parse(data);
			var queryRes = result.QueryResponse;
			if( queryRes.hasOwnProperty("Customer")) {
				var customer = result.QueryResponse.Customer[0];
				customerRef.value = customer.Id;
				customerRef.name = customer.DisplayName;
				callback(customerRef);
			} else {
				getNewCustomerId(url, oauth, obj, function(result) {
					callback(result);
				});				
			}
		}
	});	
}

function getNewCustomerId(url, oauth,obj,callback) {
	var customerRef = {};
	url += companyId + "/customer";
	postData;
	postData = {
		DisplayName : obj.customerName,
		PrimaryEmailAddr : { Address : obj.email },
		PrimaryPhone : { FreeFormNumber : obj.billingAddress.phone },
		BillAddr : { Line1 : obj.billingAddress.street,
	 	City : obj.billingAddress.city,
		Country : obj.billingAddress.country,
		 CountrySubDivisionCode : obj.billingAddress.state,
		 PostalCode : obj.billingAddress.zip 
		}
	};
	var Params = oauth._prepareParameters(apiPassword,tokenSecret,"POST",url);
	var auth = oauth._buildAuthorizationHeaders(Params);
	var args = {
		data:postData,
		headers : {Authorization: auth,Accept: "application/json","Content-Type":"application/json"}
	};
	client.post(url, args, function (data, res) {
		var customer = data.Customer;
		customerRef.value = customer.Id;
		customerRef.Name = customer.DisplayName;
    }).on('error',function(err) {
        console.log(errMsg, err.request.options);
     //   emitter.emit('error',errMsg);
	});
	callback(customerRef);
}

function getItemId(url, oauth, item,callback) {
	var id = '', query;
	if(item.sku == ''){
		query = "select * from item where Name in ('" + item.name + "')";
	} else {
		query = "select * from item where Sku in ('" + item.sku + "')";
	}
	var newUrl = url + companyId + "/query?query= " + encodeURIComponent(query);
	oauth.get(newUrl, apiPassword, tokenSecret, function(err, data, res){
		if(err) {
			console.log(errMsg,err);
		//	emitter.emit('error',errMsg);
		} else {
			var result = JSON.parse(data);
			var queryRes = result.QueryResponse;
			if(queryRes.hasOwnProperty("Item")) {
				var product = result.QueryResponse.Item[0];
				id = product.Id;	
				callback(id);			
			} else {
				getNewItemId(url, oauth, item,function(result){
					id = result;
					callback(id);
				});
			}
		}
	});
}

function getNewItemId(url, oauth, item,callback) {
	var id;
	url += companyId + "/item";
	postData = {
			Name: item.name,
			UnitPrice: item.price,
			Sku: item.sku,
  			IncomeAccountRef: {value: incomeAccNo, name:incomeAccName },
  			ExpenseAccountRef: {value: expenseAccNo , name: expenseAccName },
			AssetAccountRef: {value: assetAccNo,name: assetAccName},
  			Type: "Inventory",
  			TrackQtyOnHand: false,
  			QtyOnHand:item.qtyOnHand,
  			InvStartDate: new Date()
		};
		var Params = oauth._prepareParameters(apiPassword,tokenSecret,"POST",url);
		var auth = oauth._buildAuthorizationHeaders(Params);
		var args = {
			data:postData,
			headers : {Authorization: auth,Accept: "application/json","Content-Type":"application/json"}
		};
		client.post(url, args, function (data, res) {
			var product = data.Item;
			id = product.Id;
        }).on('error',function(err) {
            console.log(errMsg, err.request.options);
 //           emitter.emit('error',errMsg);
    	});
    	callback(id);	
}


function post(Response, node) {
	console.log("Quickbooks Response: %j", Response);
	node.resData = Response;
	//emitter.emit('success',node);
}

function testApp() {
	var requestUrl = "https://oauth.intuit.com/oauth/v1/get_request_token";
	var authorizeUrl = "https://appcenter.intuit.com/Connect/Begin";
	var result;
	
	if(accountType.toLowerCase() == "sandbox") {
		url = "https://sandbox-quickbooks.api.intuit.com/v3/company/";
	} else {
		url = "https://quickbooks.api.intuit.com/v3/company/";
	}
	oauth = new OAuth(requestUrl, authorizeUrl, apiKey, consumerSecret, "1.0", null,
		"HMAC-SHA1", null, { Accept : "application/json"} );
	var query = "select * from customer";	
	url += companyId + "/query?query=" + encodeURIComponent(query);
	console.log(url);
	oauth.get(url,apiPassword,tokenSecret,function(err,data,res) {
		if(err) {
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
		console.log(result);
		return result;
	});
}

module.exports = (function(node) {
	var Quickbooks = {
		init: function(node) {
			var credentials = node.credentials;
			apiKey = credentials.apiKey;
			consumerSecret = credentials.consumerSecret;
			apiPassword = credentials.apiPassword;
			tokenSecret = credentials.tokenSecret;
			accountType = credentials.accountType;
			companyId = credentials.companyId;
			incomeAccNo = credentials.incomeAccNo;
			incomeAccName = credentials.incomeAccName;
			expenseAccNo = credentials.expenseAccNo;
			expenseAccName = credentials.expenseAccName;
			assetAccNo = credentials.assetAccNo;
			assetAccName = credentials.assetAccName;
			run(node);
		},
		test: function(request) {
			var credentials = request.credentials;
			apiKey = credentials.apiKey;
			consumerSecret = credentials.consumerSecret;
			apiPassword = credentials.apiPassword;
			tokenSecret = credentials.tokenSecret;
			accountType = credentials.accountType;
			companyId = credentials.companyId;
			testApp();
		}
	};
	return Quickbooks;
})();   