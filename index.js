const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  try {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'any-proxy/1.0.0'
      }
    };
    
    const proxyReq = client.request(options, (proxyRes) => {
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'text/plain');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (error) => {
      console.error('Proxy request error:', error);
      res.status(500).json({ error: 'Failed to fetch the requested URL' });
    });
    
    proxyReq.setTimeout(10000, () => {
      proxyReq.destroy();
      res.status(408).json({ error: 'Request timeout' });
    });
    
    proxyReq.end();
    
  } catch (error) {
    console.error('URL parsing error:', error);
    res.status(400).json({ error: 'Invalid URL format' });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'Any Proxy Server',
    usage: 'GET /proxy?url=<target_url>',
    example: '/proxy?url=https://jsonplaceholder.typicode.com/posts/1'
  });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} for usage information`);
});