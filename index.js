const express = require("express");
var cors = require("cors");
const { MongoClient } = require("mongodb");
require("dotenv").config();
const ObjectID = require("mongodb").ObjectId;
const { json } = require("express/lib/response");
const app = express();
const port = process.env.PORT || 5000;

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
    const cartCollection = database.collection("cart");
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

    app.post("/addToCart", async (req, res) => {
      const find = await cartCollection.findOne({
        _id: req?.body?._id,
      });
      if (!find) {
        const result = await cartCollection.insertOne(req.body);
        res.json(result);
      } else {
        const quantity = find.quantity;
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            quantity: parseInt(quantity) + 1,
          },
        };
        const result = await cartCollection.updateOne(find, updateDoc, options);
        res.json(result);
      }
    });

    app.get("/myCart", async (req, res) => {
      const result = await cartCollection.find({}).toArray();
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
