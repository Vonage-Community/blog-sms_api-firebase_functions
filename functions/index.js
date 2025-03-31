require("dotenv").config();

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { Vonage } = require("@vonage/server-sdk");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://name_of_the_database.region.firebasedatabase.app",
});

// If you are using .env
const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
});

// // If you are using the Firebase Environment Variables
// const {
//   api_key,
//   api_secret
// } = functions.config().vonage;

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
  .ref("/msgq/{pushId}")
  .onCreate(async (message) => {
    const { msisdn, text, to } = message.val();

    const resultSnapshot = await message.ref.parent
      .child("result")
      .once("value");
    if (resultSnapshot.exists()) {
      console.log("Result exists already.");
      return;
    }

    try {
      const responseData = await vonage.sms.send({
        to: to,
        from: msisdn,
        text: `You sent the following text: ${text}`,
      });

      if (responseData.messages && responseData.messages[0].status === "0") {
        const result = `You sent the following text: ${responseData.messages[0]["message-id"]}`;
        await message.ref.parent.child("result").set(result);
        console.log(result);
        return result;
      } else {
        const errorText =
          (responseData.messages && responseData.messages[0]["error-text"]) ||
          "Unknown error";
        const errorMessage = `Message has failed with error: ${errorText}`;
        console.error(errorMessage);
        return errorMessage;
      }
    } catch (err) {
      console.error("Vonage error:", err);
      return `Vonage error: ${err.message}`;
    }
  });
