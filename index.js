const express = require("express");
var cors = require("cors");
const { MongoClient } = require("mongodb");
require("dotenv").config();
const ObjectID = require("mongodb").ObjectId;
const { json } = require("express/lib/response");
const app = express();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET);

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hg2sj.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    await client.connect();
    console.log("database connected");
    const database = client.db("drone-bangladesh");
    const productsCollection = database.collection("products");
    const orderCollection = database.collection("order");
    app.get("/products", async (req, res) => {
      const result = await productsCollection.find({}).toArray();
      res.json(result);
    });
    app.get("/product/:id", async (req, res) => {
      const result = await productsCollection.findOne({
        _id: ObjectID(req?.params?.id),
      });
      res.json(result);
    });

    app.post("/order", async (req, res) => {
      const result = await orderCollection.insertOne(req.body);
      res.json(result);
    });
    app.put("/order", async (req, res) => {
      const find = await orderCollection.findOne({
        _id: ObjectID(req?.body?._id),
      });
      const payment = req.body.payment;
      const updateDoc = {
        $set: {
          orderName: req.body.orderName,
          orderEmail: req.body.orderEmail,
          orderPhone: req.body.orderPhone,
          orderAddress: req.body.orderAddress,
          orderCity: req.body.orderCity,
          orderPostalCode: req.body.orderPostalCode,
          totalShoppingCost: req.body.totalShoppingCost,
        },
      };
      const result = await orderCollection.updateOne(find, updateDoc);
      res.json(result);
    });

    app.put("/payment/:id", async (req, res) => {
      const find = await orderCollection.findOne({
        _id: ObjectID(req?.params?.id),
      });
      const payment = req.body;
      const updateDoc = {
        $set: { payment: payment },
      };
      const result = await orderCollection.updateOne(find, updateDoc);
      console.log(result);
      res.json(result);
    });

    app.get("/order/:id", async (req, res) => {
      const result = await orderCollection.findOne({
        _id: ObjectID(req.params.id),
      });
      // console.log(result);
      res.json(result);
    });

    // payment
    app.post("/create-payment-intent", async (req, res) => {
      const paymentInfo = req.body.totalShoppingCost;
      const amount = paymentInfo * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
      });
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Drone bangladesh server Runing");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
