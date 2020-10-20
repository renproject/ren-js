package main

import (
	"fmt"

	filaddress "github.com/filecoin-project/go-address"
)

// DecodeAddress implements the address.Decoder interface. It receives a human
// readable address and decodes it to an address represented by raw bytes.
func DecodeAddress() error {
	rawAddr, err := filaddress.NewFromString("t1zl3sj2t7eazaojiqytccq4zlwosjxixsnf4rhyy")
	if err != nil {
		return err
	}
	fmt.Println(rawAddr.Bytes())
	return nil
}
