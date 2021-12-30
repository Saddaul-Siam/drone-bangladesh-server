const SSLCommerzPayment = require("sslcommerz");
const { v4: uuidv4 } = require("uuid");
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
app.use(express.urlencoded({ extended: true }));

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

    ///////////////////////// products /////////////////////////////

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
    ///////////////////////// products /////////////////////////////

    ///////////////////////// orders /////////////////////////////
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
    ///////////////////////// orders /////////////////////////////

    //////////////////////// User section /////////////////////

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

    //////////////////////////// review ////////////////////////////////////

    app.post("/addReview", async (req, res) => {
      const result = await reviewCollection.insertOne(req.body);
      res.json(result);
    });

    app.get("/reviews", async (req, res) => {
      const cursor = reviewCollection.find({});
      const page = req.query.page;
      const size = parseInt(req.query.size);
      let reviews;
      const count = await cursor.count();

      if (page) {
        reviews = await cursor
          .skip(page * size)
          .limit(size)
          .toArray();
      } else {
        reviews = await cursor.toArray();
      }

      res.send({
        count,
        reviews,
      });
    });
    //////////////////// payment///////////////////////////////

    //////////////////// stripe///////////////////////////////
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
    //////////////////// stripe///////////////////////////////

    ////////////////////////// SSL commerz /////////////////////////////
    app.put("/init", async (req, res) => {
      const data = {
        total_amount: req.body.totalShoppingCost,
        currency: "USD",
        tran_id: uuidv4(),
        success_url: "https://drone-bangladesh.web.app/success",
        fail_url: "https://glacial-earth-17759.herokuapp.com/fail",
        cancel_url: "https://glacial-earth-17759.herokuapp.com/cancel",
        ipn_url: "https://glacial-earth-17759.herokuapp.com/ipn",
        shipping_method: "Courier",
        product_name: "Computer.",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: "Customer Name",
        cus_email: "cust@yahoo.com",
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
        multi_card_name: "mastercard",
        value_a: "ref001_A",
        value_b: "ref002_B",
        value_c: "ref003_C",
        value_d: "ref004_D",
      };
      const find = await orderCollection.findOne({
        _id: ObjectID(req.body._id),
      });
      const updateDoc = {
        $set: { payment: data, tran_id: data.tran_id },
      };
      const result = await orderCollection.updateOne(find, updateDoc);
      const sslcommer = new SSLCommerzPayment(
        process.env.STORE_ID,
        process.env.STORE_PASS,
        false
      );
      sslcommer.init(data).then((data) => {
        if (data.GatewayPageURL) {
          res.json(data.GatewayPageURL);
        } else
          res.status(400).json({
            message: "payment session failed",
          });
      });
    });

    app.post("/success", (req, res) => {
      res.redirect("http://drone-bangladesh.web.app/dashboard/myOrder");
    });
    app.post("/fail", async (req, res) => {
      const result = await orderCollection.deleteOne({
        tran_id: req.body.tran_id,
      });
      res.redirect(`http://drone-bangladesh.web.app`);
    });
    app.post("/cancel", async (req, res) => {
      const result = await orderCollection.deleteOne({
        tran_id: req.body.tran_id,
      });
      res.redirect(`http://drone-bangladesh.web.app`);
    });
    app.post("/ipn", (req, res) => {
      res.json(req.body);
    });
    ////////////////////////// SSL commerz /////////////////////////////

    //////////////////// payment///////////////////////////////
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
