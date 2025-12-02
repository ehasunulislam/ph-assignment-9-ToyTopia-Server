const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

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
    /* create collection end */

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
