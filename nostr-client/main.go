package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"time"

	gonostr "fiatjaf.com/nostr"
	"fiatjaf.com/nostr/keyer"
)

const (
	requestKind  = 27483
	responseKind = 27484
)

func main() {
	relayURL := flag.String("relay", "", "relay websocket URL, e.g. ws://localhost:7777")
	aspHex := flag.String("asp", "", "ASP (arkd) nostr pubkey, hex (from arkd's startup log)")
	method := flag.String("method", "get_info", "method name for the m tag")
	timeout := flag.Duration("timeout", 10*time.Second, "how long to wait for a response")
	flag.Parse()

	if *relayURL == "" || *aspHex == "" {
		log.Fatal("both -relay and -asp are required")
	}

	aspPub, err := gonostr.PubKeyFromHex(*aspHex)
	if err != nil {
		log.Fatalf("invalid -asp pubkey: %v", err)
	}

	// Ephemeral client identity, just for this one request.
	ks := keyer.NewPlainKeySigner(gonostr.Generate())

	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	reqBody, _ := json.Marshal(map[string]any{
		"method": *method,
		"params": map[string]any{},
	})
	ciphertext, err := ks.Encrypt(ctx, string(reqBody), aspPub)
	if err != nil {
		log.Fatalf("encrypt request: %v", err)
	}

	ev := gonostr.Event{
		CreatedAt: gonostr.Now(),
		Kind:      requestKind,
		Tags: gonostr.Tags{
			{"p", aspPub.Hex()},
			{"m", *method},
			{"encryption", "nip44_v2"},
		},
		Content: ciphertext,
	}
	if err := ks.SignEvent(ctx, &ev); err != nil {
		log.Fatalf("sign request: %v", err)
	}

	relay, err := gonostr.RelayConnect(ctx, *relayURL, gonostr.RelayOptions{})
	if err != nil {
		log.Fatalf("connect relay: %v", err)
	}
	defer relay.Close()
	log.Printf("connected to %s", *relayURL)

	// Subscribe for the response BEFORE publishing: kind 27484 is ephemeral,
	// so if we publish first the relay may forward the reply before we're listening.
	sub, err := relay.Subscribe(ctx, gonostr.Filter{
		Kinds:   []gonostr.Kind{responseKind},
		Authors: []gonostr.PubKey{aspPub},
		Tags:    gonostr.TagMap{"e": []string{ev.ID.Hex()}},
	}, gonostr.SubscriptionOptions{})
	if err != nil {
		log.Fatalf("subscribe: %v", err)
	}

	if err := relay.Publish(ctx, ev); err != nil {
		log.Fatalf("publish request: %v", err)
	}
	log.Printf("published %q request (event id %s), waiting for response...", *method, ev.ID.Hex())

	for {
		select {
		case resp, ok := <-sub.Events:
			if !ok {
				log.Fatal("subscription closed before a response arrived")
			}
			plaintext, err := ks.Decrypt(ctx, resp.Content, aspPub)
			if err != nil {
				log.Fatalf("decrypt response: %v", err)
			}
			var pretty bytes.Buffer
			if json.Indent(&pretty, []byte(plaintext), "", "  ") == nil {
				fmt.Println(pretty.String())
			} else {
				fmt.Println(plaintext)
			}
			return
		case <-ctx.Done():
			log.Fatalf("timed out after %s waiting for a response", *timeout)
		}
	}
}
