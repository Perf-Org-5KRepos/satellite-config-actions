

import { getInput, setOutput, setFailed } from '@actions/core';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import jwtDecode from 'jwt-decode';

/*
* Get the IAM bearer token using an API key
*/
const getBearer = async (apikey) => {
    console.log( 'Signing in to IBM Cloud' );
    const params = new URLSearchParams();
    params.append('grant_type', 'urn:ibm:params:oauth:grant-type:apikey');
    params.append('apikey', apikey);
    const response = await fetch('https://iam.test.cloud.ibm.com/identity/token', { method: 'POST', body: params });
    const json = await response.json();
    const bearer = json.access_token;
    return bearer;
}

/*
* Call the SatCon API to upload a new version to a channel
*/
const uploadVersion = async (token, filename, channelId, version) => {
    // Load file
    console.log( 'Uploading %s to channel %s as version %s', filename, channelId, version )
    const content = readFileSync(filename, 'utf8');

    // Build the content package
    const jwt = jwtDecode(token);
    const bss = jwt.account.bss;
    const request =
    {
        "query": "mutation addChannelVersion($org_id: String!, $channel_id: String!, $name: String!, $type: String!, $content: String!, $description: String) { addChannelVersion(org_id: $org_id, channel_uuid: $channel_id, name: $name, type: $type, content: $content, description: $description) {success version_uuid}}",
        "variables":
        {
            "org_id": bss,
            "channel_id": channelId,
            "name": version,
            "type": "application/yaml",
            "content": content,
            "description": null
        },
        "operationName": "addChannelVersion"
    };

    // Call API
    const headers = { 'content-type': 'application/json', 'authorization': 'Bearer ' + token };
    const fetchResponse = await fetch('https://api.razee.test.cloud.ibm.com/graphql', { method: 'POST', headers: headers, body: JSON.stringify(request) })
    const response = await fetchResponse.json();
    if ( response.errors ) {
        throw new Error (response.errors[0].message);
    }
    console.log( 'Version ID %s', response.data.addChannelVersion.version_uuid );
    return response.data.addChannelVersion.version_uuid;
}

async function main() {
    try {
        // get the Bearer token
        const apikey = getInput('apikey');
        if ( !apikey ) {
            throw new Error('Missing apikey');
        }
        const bearer = await getBearer(apikey);

        // upload the file
        const filename = getInput('filename');
        const channelId = getInput('channel_id');
        const versionName = getInput('version_name');
        const versionid = await uploadVersion(bearer, filename, channelId, versionName);

        setOutput("versionid", versionid);
    } catch (error) {
        setFailed(error.message);
    }
}

main();