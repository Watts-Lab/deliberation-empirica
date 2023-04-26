requires file `appSecrets.tfvars` in same directory, containing:

```tf
# appSecrets.tfvars

app_secrets = [
    {name = "DAILY_APIKEY", value = "???"},
    {name = "QUALTRICS_API_TOKEN", value = "???"},
    {name = "QUALTRICS_DATACENTER", value = "iad1"},
    {name = "GH_SSH", value = "???"},
    {name = "GH_TOKEN", value="???"},
    {name = "GH_DATA_REPO", value="Watts-Lab/deliberation-data-private"},
    {name = "GH_BRANCH", value="main"},
    {name = "REACT_APP_TEST_CONTROLS", value="disabled"}
]
```

### Commands
First authenticate to aws using penn's federated auth (or whatever)

- initialize terraform : `terraform init`
- deploy: `terraform apply`
- get current state: `terraform refresh`
- destroy: `terrafrom destroy`