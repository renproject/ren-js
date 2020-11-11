# `@renproject/multiwallet-base-connector`

This package specifies the base interface required for a connector to expose in order to provide wallet support for the chains defined in `@renproject/chains`.

It wraps and emits events in a standard manner to update consumers on when a wallet has been connected, updates to the accounts that it has access to, and whether an error or disconnection event has ocurred.
