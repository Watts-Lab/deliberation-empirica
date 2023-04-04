import Qualtrics from "qualtrics-api";

/* 
config can be changed, go to Qualtrics IDs under "My Account"
documentation for this import here: https://www.npmjs.com/package/qualtrics-api
*/ 

const config = {
    apiToken: 'vkFx6SfjGhNjLxpTLo2ha1E7PHfS2GmNzGUnD7VJ',
    baseUrl: 'https://eu.qualtrics.com/API/v3/',
    DefaultDirectory: 'POOL_1FQGZPSIEWYvyQ7'
}


export async function getQualtricsData({surveyId , sessionId}) {
    const qualtrics = new Qualtrics(config);
    try{
        const result = await qualtrics.whoami()
                                .then(r => {console.log(r)})
                                .catch(console.error)
        return result
    }catch(error){
        console.log(error);
        return undefined
    }
}






  
  
  