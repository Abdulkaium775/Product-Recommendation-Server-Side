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
    const recommendationCollection = db.collection('recommendations');

    // --- PRODUCTS ROUTES ---

    // GET all products
    app.get('/products', async (req, res) => {
      const result = await dataCollection.find().toArray();
      res.send(result);
    });

    // GET a product by ID
    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      try {
        const product = await dataCollection.findOne({ _id: new ObjectId(id) });
        if (!product) return res.status(404).json({ error: 'Query not found' });
        res.json(product);
      } catch (error) {
        console.error('Error fetching product by ID:', error);
        res.status(500).json({ error: 'Server error' });
      }
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
      const updateDoc = { $set: update };
      const result = await dataCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    // DELETE a product by ID
    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id;
      const result = await dataCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // --- RECOMMENDATIONS ROUTES ---

    // GET all recommendations by recommenderEmail (query param: ?email=)
    app.get('/recommendations', async (req, res) => {
      const email = req.query.email;
      try {
        const result = await recommendationCollection.find({ recommenderEmail: email }).toArray();
        res.send(result);
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        res.status(500).json({ error: 'Server Error' });
      }
    });

    // POST a new recommendation and increment recommendationCount on product
    app.post('/recommendations', async (req, res) => {
      const recommendation = req.body;
      try {
        const result = await recommendationCollection.insertOne(recommendation);

        await dataCollection.updateOne(
          { _id: new ObjectId(recommendation.queryId) },
          { $inc: { recommendationCount: 1 } }
        );

        res.send(result);
      } catch (err) {
        console.error('Error adding recommendation:', err);
        res.status(500).json({ error: 'Server Error' });
      }
    });

    // DELETE a recommendation by ID and decrement recommendationCount on product
    app.delete('/recommendations/:id', async (req, res) => {
      const id = req.params.id;

      try {
        const recommendation = await recommendationCollection.findOne({ _id: new ObjectId(id) });
        if (!recommendation) return res.status(404).json({ error: 'Recommendation not found' });

        const deleteResult = await recommendationCollection.deleteOne({ _id: new ObjectId(id) });

        const updateResult = await dataCollection.updateOne(
          { _id: new ObjectId(recommendation.queryId) },
          { $inc: { recommendationCount: -1 } }
        );

        res.send({ deleteResult, updateResult });
      } catch (err) {
        console.error('Error deleting recommendation:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    // GET recommendations made by others on queries posted by the logged-in user
    app.get('/myqueries/recommendations', async (req, res) => {
      const userEmail = req.query.email;
      if (!userEmail) return res.status(400).json({ error: 'Missing user email' });

      try {
        const userQueries = await dataCollection.find({ userEmail }).project({ _id: 1 }).toArray();
        const queryIds = userQueries.map((q) => q._id);

        if (queryIds.length === 0) return res.json([]);

        const recommendations = await recommendationCollection.find({
          queryId: { $in: queryIds },
          recommenderEmail: { $ne: userEmail },
        }).toArray();

        res.json(recommendations);
      } catch (err) {
        console.error('Error fetching recommendations for user queries:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    await client.db('admin').command({ ping: 1 });
    console.log('Connected to MongoDB!');
  } catch (error) {
    console.error('MongoDB connection error:', error);
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