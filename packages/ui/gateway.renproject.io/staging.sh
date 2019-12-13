#!/usr/bin/env bash
#
# This script will deploy a version of the Gateway website
# to Github pages, with the /test endpoint enabled.
#
# This is available at: renproject.github.io/gateway.renproject.io/#/test


export PUBLIC_URL="/gateway.renproject.io"
export REACT_APP_ENABLE_TEST_ENDPOINT=1
export REACT_APP_GATEWAY_POPUP_URL="https://renproject.github.io${PUBLIC_URL}"

yarn run build && yarn gh-pages -d ./build
