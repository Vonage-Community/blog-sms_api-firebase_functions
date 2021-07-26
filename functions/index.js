require('dotenv').config();

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Vonage = require('@vonage/server-sdk');

admin.initializeApp();

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
});

// This function will serve as the webhook for incoming SMS messages,
// and will log the message into the Firebase Realtime Database
exports.inboundSMS = functions.https.onRequest(async (req, res) => {
  let params;
  if (Object.keys(req.query).length === 0) {
    params = req.body;
  } else {
    params = req.query;
  }
  await admin.database().ref('/msgq').push(params);
  res.sendStatus(200);
});

// This function listens for updates to the Firebase Realtime Database
// and sends a message back to the original sender
exports.sendSMS = functions.database
  .ref('/msgq/{pushId}')
  .onCreate(async (message) => {
    const { msisdn, text, to } = message.val();
    const result = await new Promise((resolve, reject) => {
      vonage.message.sendSms(msisdn, to, `You sent the following text: ${text}`, (err, responseData) => {
        if (err) {
          return reject(new Error(err));
        } else {
          if (responseData.messages[0].status === '0') {
            return resolve(
              `Message sent successfully: ${responseData.messages[0]['message-id']}`
            );
          } else {
            return reject(
              new Error(
                `Message failed with error: ${responseData.messages[0]['error-text']}`
              )
            );
          }
        }
      });
    });
    return message.ref.parent.child('result').set(result);
  });
