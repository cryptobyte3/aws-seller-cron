require('dotenv').config();
const http = require("http");
var app = require("./app");
var cron = require('node-cron');
var MongoClient = require("mongodb").MongoClient;
var ObjectId = require("mongodb").ObjectId;
var OneSignal = require('onesignal-node');
var URL = process.env.MONGO_URL;

const port = process.env.PORT || 3000;

const server = http.createServer(app);
// var io = require("socket.io")(server);
// io.origins("*:*");
// io.on("connection", function(socket) {
//   console.log("a user connected");
// });

// const Pusher = require("pusher");

// const pusher = new Pusher({
//   appId: "528462",
//   key: "edc0fafa92d65aa9bace",
//   secret: "f5f7bb64d29de2bb3092",
//   cluster: "us2",
//   encrypted: true
// });

var myClient = new OneSignal.Client({    
   userAuthKey: 'MjljYzViY2MtOTY1YS00MmI0LTk5ZDgtODU4MzlkZDNkZmEz',    
   app: { appAuthKey: 'OTZmZTcwZDYtMWI1MC00NmE1LThlMjItODllZjg3MjUyMTk3', appId: '0b6427d6-620b-457e-bd39-2cb8058ff542' }
});  


cron.schedule('5 * * * *', () => {
	console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
	MongoClient.connect(URL, function(err, db) {
	    if (err) throw err;
	    var collection = db.collection("users");
	    var users = collection
			.find({})
			.toArray()
			.then(result => {
		        result.map(async (res) => {
					var amazonMws = require('amazon-mws')(process.env.AWS_ACCESS_KEY, process.env.SECRET_KEY);	
					// var diff = Math.abs(new Date() - new Date(res['last_date']));
					// var minutes = Math.floor((diff/1000)/60);
					let reponse;
					try {
			         	response = await amazonMws.orders.search({
				        	'Version': '2013-09-01',
						    'Action': 'ListOrders',
						    'SellerId': res['seller_id'],
						    'MWSAuthToken': res['mws_auth_token'],
			             	'MarketplaceId.Id.1': res['market_place_id'],
						    // 'LastUpdatedAfter': res['last_date']
						    'LastUpdatedAfter': new Date(2018,11,6,),
						    'OrderStatus.Status.1': 'Pending'
						});
					    for (var i = 0; i < response.Orders.Order.length; i++) {
					    	let order = response.Orders.Order[i];
					    	try{
					       		let responseOrderItem = await amazonMws.orders.search({
								    'Version': '2013-09-01',
								    'Action': 'ListOrderItems',
						    		'SellerId': res['seller_id'],
								    'MWSAuthToken': res['mws_auth_token'],
								    'AmazonOrderId' : order['AmazonOrderId'],
								}); 
								try{
									let product = await amazonMws.products.searchFor({
								        'Version': '2011-10-01',
								        'Action': 'GetLowestPricedOffersForSKU',
								        'SellerId': res['seller_id'],
									    'MWSAuthToken': res['mws_auth_token'],
						             	'MarketplaceId': res['market_place_id'],
								        'SellerSKU': responseOrderItem.OrderItems.OrderItem.SellerSKU,
								        'ItemCondition': 'New'
								    });
								    // console.log('#############', product)
								    // console.log('@@@@@@@@@@@@@', product.Summary.BuyBoxPrices.BuyBoxPrice)
								 	// LandedPrice: { CurrencyCode: 'USD', Amount: '8.00' },
									// ListingPrice: { CurrencyCode: 'USD', Amount: '8.00' },
									// Shipping: { CurrencyCode: 'USD', Amount: '0.00' } }
									var notification = new OneSignal.Notification({    
									    contents: {    
									        en: responseOrderItem.OrderItems.OrderItem.QuantityOrdered + ' ' + (responseOrderItem.OrderItems.OrderItem.Title.length > 20? responseOrderItem.OrderItems.OrderItem.Title.slice(0,20)+'...' : responseOrderItem.OrderItems.OrderItem.Title) + 
									        	' for ' + ( parseFloat(product.Summary.BuyBoxPrices.BuyBoxPrice.ListingPrice.Amount) * parseInt(responseOrderItem.OrderItems.OrderItem.QuantityOrdered) ).toString() + ' ' + product.Summary.BuyBoxPrices.BuyBoxPrice.ListingPrice.CurrencyCode
									    },
									    title: 'New Order'
									});  
									notification.postBody["filters"] = [{"field": "tag", "key": "userId", "relation": "=" ,"value": ObjectId(res['_id'])}];
									notification.postBody["included_segments"] = ["Active Users"];    
									notification.postBody["excluded_segments"] = ["Banned Users"];
									myClient.sendNotification(notification)
								    .then(function (response) {
								        console.log(response.data, response.httpResponse.statusCode);
								    })
								    .catch(function (err) {
								        console.log('Something went wrong...', err);
								    });
							    }catch(error){
				        			console.log('~~~~~~~~~~~ too many request ~~~~~~~~~~~ error ', error);
							    }

							} catch(error){
				        		console.log('~~~~~~~~~~~ too many request ~~~~~~~~~~~ error ', error);
							}
						}
		         	} catch(error) {
				        console.log('~~~~~~~~~~~ too many request ~~~~~~~~~~~ error ', error);
					}
					delete res.last_date;
				    collection
			      	.update(
				        { _id: ObjectId(res['_id']) },
				        { last_date: new Date(), ...res }
			      	)
	        	})
	      	});
  	});
});

console.log("running on http://localhost:" + port);
server.listen(port);
