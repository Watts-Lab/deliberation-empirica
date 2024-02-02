// Get a list of known VPN providers ips

import { get } from "axios";

export async function getVpnList() {
  const response = await get(
    "https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/datacenter/ipv4.txt"
  );
  const rawVpnList = response.data.split("\n");
  const addressOnly = rawVpnList.map((line) => line.split("/")[0]);
  console.log(`Loaded ${addressOnly.length} VPN/Datacenter ip addresses`);
  return addressOnly;
}
