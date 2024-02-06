require("dotenv").config();

const { onRequest } = require("firebase-functions/v2/https");
const { onValueCreated } = require("firebase-functions/v2/database");

const { Vonage } = require("@vonage/server-sdk");
const { SMS } = require("@vonage/messages");

const admin = require("firebase-admin");

admin.initializeApp();

exports.inboundSMS = onRequest(async (request, response) => {
  params = request.body;
  await admin.database().ref("/msgq").push(params);
  response.sendStatus(200);
});

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
  applicationId: process.env.VONAGE_APPLICATION_ID,
  privateKey: process.env.VONAGE_PRIVATE_KEY,
});

exports.sendSMS = onValueCreated("/msgq/{pushId}", async (message) => {
  const { from, text } = message.data.val();

  vonage.messages
    .send(
      new SMS({
        text: text,
        to: from,
        from: "Vonage APIs",
      })
    )
    .then((resp) => console.log(resp))
    .catch((err) => console.error(err));
});
