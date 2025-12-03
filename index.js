const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

// stripe require working: 1
const stripe = require("stripe")(process.env.STRIPE_SECRET);

// middleware
app.use(express.json());
app.use(cors());

/* mongoDB functionality start */
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@ic-cluster.qdhi4wp.mongodb.net/?appName=ic-cluster`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    /* create collection start */
    const db = client.db("toytopia");
    const toysCollection = db.collection("toys");
    const commentCollection = db.collection("comments");
    const addToCartCollection = db.collection("add-to-cart");
    /* create collection end */

    /* add to cart APIs start */
    app.get("/add-to-cart/:email", async (req, res) => {
      const userEmail = req.params.email;

      try {
        const result = await addToCartCollection.find({ userEmail }).toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    // get apIs for single product payment
    app.get("/add-to-cart/item/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await addToCartCollection.findOne(query);
      res.send(result);
    });

    app.post("/add-to-cart", async (req, res) => {
      const { userEmail, productId, ...rest } = req.body;
      const existing = await addToCartCollection.findOne({
        userEmail,
        productId,
      });

      if (existing) {
        return res.status(400).send({ message: "Product already in cart" });
      }

      const result = await addToCartCollection.insertOne({
        userEmail,
        productId,
        ...rest,
        paid: false,
        createdAt: new Date(),
      });

      res.send(result);
    });

    app.delete("/add-to-cart/:email/:productId", async (req, res) => {
      const { email, productId } = req.params;

      try {
        const result = await addToCartCollection.deleteOne({
          userEmail: email,
          productId: productId,
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Cart item not found" });
        }

        res.send({ message: "Cart item removed successfully" });
      } catch (err) {
        console.log(err);
        res.status(500).send({ message: "Server error" });
      }
    });
    /* add to cart APIs end */

    /* toys APIs start */
    app.get("/toys-home", async (req, res) => {
      const cursor = toysCollection.find().sort({ createdAt: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/toys-all", async (req, res) => {
      const cursor = toysCollection.find().sort({ createdAt: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/toys/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      try {
        const result = await toysCollection.findOne(query);

        if (!result) {
          return res.status(404).send({ message: "Toy not found" });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Invalid ID format" });
      }
    });

    app.get("/toys-by-email", async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }

      try {
        const query = { sellerEmail: email };
        const result = await toysCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Something went wrong" });
      }
    });

    app.post("/toys-upload", async (req, res) => {
      const toysData = req.body;
      toysData.createdAt = new Date();
      const result = await toysCollection.insertOne(toysData);
      res.send(result);
    });

    app.put("/toys/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updateCar = req.body;

        delete updateCar._id;

        const filter = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: updateCar,
        };

        const result = await toysCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount === 1) {
          return res.send({ success: true, message: "Updated" });
        }

        return res.send({ success: false, message: "No changes found" });
      } catch (error) {
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    app.delete("/toys/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await toysCollection.deleteOne(query);
      res.send(result);
    });
    /* toys APIs end */

    /* comments APIs start */
    app.get("/product-comments/:productId", async (req, res) => {
      const { productId } = req.params;
      try {
        const comments = await commentCollection
          .find({ productId })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(comments);
      } catch (err) {
        res.status(500).send({ error: "Server error" });
      }
    });

    app.post("/product-comments", async (req, res) => {
      const { productId, email, comments } = req.body;

      if (!productId || !email || !comments) {
        return res.status(400).send({ error: "All fields required" });
      }

      try {
        const result = await commentCollection.insertOne({
          productId,
          email,
          comments,
          createdAt: new Date(),
        });
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Server error" });
      }
    });
    /* comments APIs end */

    /* Payment APIs start (stripe payment working: 2) */
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.price) * 100;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: paymentInfo.toyName,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo.userEmail,
        mode: "payment",
        metadata: {
          productId: paymentInfo.productId,
        },
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?productId=${paymentInfo.productId}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });

      console.log(session);
      res.send({ url: session.url });
    });

    // add-to-cat a pay btn ta paid hobe(update)
    app.post("/payment-success", async (req, res) => {
      const { productId, userEmail } = req.body;

      try {
        const result = await addToCartCollection.updateOne(
          { _id: new ObjectId(productId), userEmail },
          { $set: { paid: true } }
        );
        res.send({ success: true, result });
      } catch (err) {
        res.status(500).send({ message: "Failed to update payment status" });
      }
    });

    /* Payment APIs end */

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
/* mongoDB functionality end */

app.get("/", (req, res) => {
  res.send("Toy topia");
});

app.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
});
