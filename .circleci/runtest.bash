yarn run test --reporter mocha-multi-reporters --reporter-options configFile=.circleci/mocha.json
test_exit_code=$?
echo "$test_exit_code" > "$NETWORK"
exit "$test_exit_code"
