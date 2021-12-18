const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
require("dotenv").config();
const ObjectID = require("mongodb").ObjectId;
const { json } = require("express/lib/response");
const app = express();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_DK);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hg2sj.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    console.log("database connected");
    const database = client.db("drone-bangladesh");
    const productsCollection = database.collection("products");
    const orderCollection = database.collection("order");
    const usersCollection = database.collection("users");
    const reviewCollection = database.collection("review");

    app.post("/addProducts", verifyToken, async (req, res) => {
      const result = await productsCollection.insertOne(req.body);
      res.json(result);
    });

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

    app.delete("/deleteProducts/:id", verifyToken, async (req, res) => {
      const result = await productsCollection.deleteOne({
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

    app.get("/order/:id", async (req, res) => {
      const result = await orderCollection.findOne({
        _id: ObjectID(req.params.id),
      });
      res.json(result);
    });
    app.get("/orders/:email", async (req, res) => {
      const result = await orderCollection
        .find({ email: req.params.email })
        .toArray();
      res.json(result);
    });

    app.delete("/order/:id", verifyToken, async (req, res) => {
      const result = await orderCollection.deleteOne({
        _id: ObjectID(req.params.id),
      });
      res.json(result);
    });

    app.get("/allOrders", async (req, res) => {
      const result = await orderCollection.find({}).toArray();
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
    app.put("/payment/:id", async (req, res) => {
      const find = await orderCollection.findOne({
        _id: ObjectID(req?.params?.id),
      });
      const payment = req.body;
      const updateDoc = {
        $set: { payment: payment },
      };
      const result = await orderCollection.updateOne(find, updateDoc);
      res.json(result);
    });
    //////////////////////////// User section ////////////////////////////////////

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result);
    });

    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res
          .status(403)
          .json({ message: "you do not have access to make admin" });
      }
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    //////////////////////////// User section ////////////////////////////////////

    app.post("/addReview", async (req, res) => {
      const result = await reviewCollection.insertOne(req.body);
      res.json(result);
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
