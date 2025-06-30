const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7ky75a3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db('productDb');
    const dataCollection = db.collection('products');

    // GET all products
    app.get('/products', async (req, res) => {
      const result = await dataCollection.find().toArray();
      res.send(result);
    });

    // POST a new product
    app.post('/products', async (req, res) => {
      const newProduct = req.body;
      const result = await dataCollection.insertOne(newProduct);
      res.send(result);
    });

    // PUT (Update) a product by ID
    app.put('/products/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const update = req.body;
      const options = { upsert: true };
      const updateDoc = {
        $set: update,
      };
      const result = await dataCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    // DELETE a product by ID
    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id;
      const result = await dataCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

run().catch(console.dir);

// Default route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
