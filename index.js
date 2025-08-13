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
    app.get('/products', async (req, res) => {
      const result = await dataCollection.find().toArray();
      res.send(result);
    });

    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid product ID' });
      const product = await dataCollection.findOne({ _id: new ObjectId(id) });
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json(product);
    });

    app.post('/products', async (req, res) => {
      const newProduct = req.body;
      if (!newProduct.userEmail)
        return res.status(400).json({ error: 'userEmail is required' });

      const result = await dataCollection.insertOne({
        ...newProduct,
        recommendationCount: 0,
      });
      res.send(result);
    });

    app.put('/products/:id', async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid product ID' });

      const updateDoc = { $set: req.body };
      const result = await dataCollection.updateOne({ _id: new ObjectId(id) }, updateDoc, { upsert: true });
      res.send(result);
    });

    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid product ID' });

      const result = await dataCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // --- RECOMMENDATIONS ROUTES ---
    app.get('/recommendations', async (req, res) => {
      const email = req.query.email;
      if (!email) return res.status(400).json({ error: 'Missing email query parameter' });

      const result = await recommendationCollection.find({ recommenderEmail: email }).toArray();
      res.send(result);
    });

    app.post('/recommendations', async (req, res) => {
      const recommendation = req.body;
      if (!recommendation.queryId || !ObjectId.isValid(recommendation.queryId))
        return res.status(400).json({ error: 'Invalid or missing queryId' });

      const insertResult = await recommendationCollection.insertOne({
        ...recommendation,
        queryId: new ObjectId(recommendation.queryId),
        createdAt: new Date(),
      });

      await dataCollection.updateOne(
        { _id: new ObjectId(recommendation.queryId) },
        { $inc: { recommendationCount: 1 } }
      );

      res.send(insertResult);
    });

    app.delete('/recommendations/:id', async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid recommendation ID' });

      const recommendation = await recommendationCollection.findOne({ _id: new ObjectId(id) });
      if (!recommendation) return res.status(404).json({ error: 'Recommendation not found' });

      const deleteResult = await recommendationCollection.deleteOne({ _id: new ObjectId(id) });

      await dataCollection.updateOne(
        { _id: new ObjectId(recommendation.queryId) },
        { $inc: { recommendationCount: -1 } }
      );

      res.send({ deleteResult });
    });

    // --- RECOMMENDATIONS FOR MY QUERIES ---
    app.get('/myqueries/recommendations', async (req, res) => {
      const userEmail = req.query.email;
      if (!userEmail) return res.status(400).json({ error: 'Missing user email' });

      // Find all products posted by this user
      const userQueries = await dataCollection
        .find({ userEmail })
        .project({ _id: 1, productName: 1, queryTitle: 1 })
        .toArray();

      const queryIds = userQueries.map((q) => q._id);
      if (queryIds.length === 0) return res.json([]);

      // Recommendations on user's products by others
      const recommendations = await recommendationCollection
        .aggregate([
          {
            $match: {
              queryId: { $in: queryIds },
              recommenderEmail: { $ne: userEmail },
            },
          },
          {
            $lookup: {
              from: 'products',
              localField: 'queryId',
              foreignField: '_id',
              as: 'queryDetails',
            },
          },
          { $unwind: '$queryDetails' },
          {
            $project: {
              _id: 1,
              recommenderEmail: 1,
              boycottingReason: 1,
              recommendationText: 1,
              createdAt: 1,
              'queryDetails.productName': 1,
              'queryDetails.queryTitle': 1,
            },
          },
        ])
        .toArray();

      res.json(recommendations);
    });

    console.log('MongoDB connected and routes are ready.');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => res.send('Hello World!'));
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
