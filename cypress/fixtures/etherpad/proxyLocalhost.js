// Set up a web proxy to forward traffic from localhost:4000 to https://collab.csslabdev.com

const httpProxy = require("http-proxy");

const proxy = httpProxy
  .createProxyServer({ target: "https://collab.csslabdev.com", ws: true })
  .listen(4000);

proxy.on("error", (err, req, res) => {
  console.log("Error proxying request to target server");
  console.log(err);
  res.writeHead(500, {
    "Content-Type": "text/plain",
  });
  res.end("Something went wrong.");
});

console.log("Proxying port 4000 → https://collab.csslabdev.com");
