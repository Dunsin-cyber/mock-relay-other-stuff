## START NOSTR-RS-RELAY 
- this starts the realy on port 7777, to test it, simply use `curl http://localhost:7777`, you should get a response that says `Please use a Nostr client to connect.% `
```
docker run -it -p 7447:8080 \
--mount src=$(pwd)/config.toml,target=/usr/src/app/config.toml,type=bind \
scsibug/nostr-rs-relay 
```

