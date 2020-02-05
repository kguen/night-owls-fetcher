const express = require('express');
const app = express();
const { getFullData, getGenres, getTMDbDetails } = require('./fetcher.js');

app.get('/api/movies', async (req, res) => {
  const { format, genres, rating, fromYear, toYear, page, query, tab } = req.query;
  const data = await getFullData(format, genres, rating, fromYear, toYear, page, query, tab);
  res.send(data);
});

app.get('/api/genres', async (req, res) => {
  const data = await getGenres(req.query.format);
  res.send(data);
});

app.get('/api/details', async (req, res) => {
  const data = await getTMDbDetails(req.query.format, req.query.id);
  res.send(data);
})

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));