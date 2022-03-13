const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const objectId = require("mongodb").ObjectId;
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
// firebase token verify setup
const admin = require("firebase-admin");
const e = require("express");

const serviceAccount = JSON.parse(process.env.FIREBASEAUTH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
async function verifyUserToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const userToken = req.headers.authorization.split(" ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(userToken);
      req.decodedEmail = decodedUser.email;
    } catch (error) {
      console.log(error);
    }
  }
  next();
}
// middleware
app.use(cors());
app.use(express.json());
// mongodb config
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bdjvz.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
// mongodb connect and server api
async function run() {
  try {
    await client.connect();
    const database = client.db("sunglassDb");
    const usersCollection = database.collection("users");
    const productsCollection = database.collection("sunglassCollection");
    const cartCollection = database.collection("SunglassCarts");
    const reviewCollection = database.collection("ReviewCollection");
    app.post("/adduser", async (req, res) => {
      const newUser = req.body;
      const saveUsers = await usersCollection.insertOne(newUser);
      res.send(saveUsers);
    });
    app.put("/makeadmin", verifyUserToken, async (req, res) => {
      const userEmail = req.body.email;
      const reqUserEmail = req.decodedEmail;
      const findUser = await usersCollection.findOne({
        email: reqUserEmail,
      });
      if (findUser.role === "admin") {
        const filter = { email: userEmail };
        const updateDoc = { $set: { role: "admin" } };
        const MakeuserAdmin = await usersCollection.updateOne(
          filter,
          updateDoc
        );
        res.send(MakeuserAdmin);
      } else {
        res.send(401);
      }
    });
    app.get("/getAdmin/:email", async (req, res) => {
      const email = req.params.email;
      console.log("hitted");
      const query = { email };
      const getAdmin = await usersCollection.findOne(query);
      let isAdmin = false;
      if (getAdmin?.role === "admin") {
        isAdmin = true;
      }
      res.send({ admin: isAdmin });
    });
    // app.post("/addproducts", async (req, res) => {
    //   const newProducts = req.body;
    //   const addedProducts = await productsCollection.insertOne(newProducts);
    //   res.send(addedProducts);
    // });
    app.get("/allproducts", async (req, res) => {
      const products = productsCollection.find({});
      if ((await products.count()) > 0) {
        res.send(await products.toArray());
      } else {
        res.send({});
      }
    });
    app.delete("/deleteproduct/:id", verifyUserToken, async (req, res) => {
      const adminEmail = req.decodedEmail;
      const productId = objectId(req.params.id);
      const findAdmin = await usersCollection.findOne({ email: adminEmail });
      if (findAdmin?.role === "admin") {
        const deleteProduct = await productsCollection.deleteOne({
          _id: productId,
        });
        res.send(deleteProduct);
      } else {
        res.status(403);
      }
    });
    app.get("/getproduct/:id", verifyUserToken, async (req, res) => {
      const verifyEmail = req.decodedEmail;
      if (verifyEmail) {
        const productId = objectId(req.params.id);
        const findProducts = await productsCollection.findOne({
          _id: productId,
        });
        res.send(findProducts);
      } else {
        res.status(401).json({ message: "Your Not Authorized" });
      }
    });
    app.post("/savecarts", verifyUserToken, async (req, res) => {
      const verifyEmail = req.decodedEmail;
      const cart = req.body;
      if (verifyEmail) {
        const saveToCarts = await cartCollection.insertOne(cart);
        res.send(saveToCarts);
      } else {
        res.status(401).json({ message: "Your Not Authorized" });
      }
    });
    app.get("/myorders/:email", verifyUserToken, async (req, res) => {
      const userEmail = req.params.email;
      if (req.decodedEmail) {
        const userOrders = await cartCollection
          .find({ email: userEmail })
          .toArray();
        res.send(userOrders);
      } else {
        res.status(401).json({ message: "Unauthorized request" });
      }
    });
    app.get("/cartdelete/:id", verifyUserToken, async (req, res) => {
      const cartId = objectId(req.params.id);
      if (req.decodedEmail) {
        const deleteResult = await cartCollection.deleteOne({ _id: cartId });
        res.send(deleteResult);
      } else {
        res.status(401).json({ message: "Unauthorized request" });
      }
    });
    app.post("/addreview", verifyUserToken, async (req, res) => {
      const review = req.body;
      if (req.decodedEmail) {
        const addReview = await reviewCollection.insertOne(review);
        res.send(addReview);
      } else {
        res.status(401);
      }
    });
    app.get("/review", async (req, res) => {
      const allreview = reviewCollection.find({});
      if ((await allreview.count()) > 0) {
        res.send(await allreview.toArray());
      } else {
        res.send(404);
      }
    });
    app.get("/getorders", verifyUserToken, async (req, res) => {
      const reqUserEmail = req.decodedEmail;
      const findUser = await usersCollection.findOne({
        email: reqUserEmail,
      });
      if (findUser.role === "admin") {
        const orders = await cartCollection.find({}).toArray();
        res.send(orders);
      } else {
        res.status(401);
      }
    });
    app.get("/approve/:id", verifyUserToken, async (req, res) => {
      const reqUserEmail = req.decodedEmail;
      const cartId = objectId(req.params.id);
      const findUser = await usersCollection.findOne({
        email: reqUserEmail,
      });
      if (findUser?.role === "admin") {
        const filter = { _id: cartId };
        const updateDoc = {
          $set: {
            status: "Shipped",
          },
        };
        const updateCart = await cartCollection.updateOne(filter, updateDoc);
        res.send(updateCart);
      } else {
        res.status(401);
      }
    });
    app.delete("/deletecart/:id", verifyUserToken, async (req, res) => {
      const reqUserEmail = req.decodedEmail;
      const cartId = objectId(req.params.id);
      const findUser = await usersCollection.findOne({
        email: reqUserEmail,
      });
      if (findUser?.role === "admin") {
        const filter = { _id: cartId };
        const updateCart = await cartCollection.deleteOne(filter);
        res.send(updateCart);
      } else {
        res.status(401);
      }
    });
  } finally {
  }
}
run().catch(console.error);

// server api
app.get("/", (req, res) => {
  res.send("Server RuNNing sUcesSfuLLy");
});
app.listen(port, (req, res) => {
  console.log(`Server Running On http://localhost:${port}`);
});
