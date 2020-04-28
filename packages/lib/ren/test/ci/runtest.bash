yarn run test:unit --reporter mocha-multi-reporters --reporter-options configFile=.circleci/mocha.json
test_exit_code=$?
echo "$test_exit_code" > "$NETWORK"

# Only fails tests for testnet
if [ "$NETWORK" == "testnet" ]; then
    exit "$test_exit_code"
fi