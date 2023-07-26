import fetch from 'node-fetch';

export async function getEtherpadText({ padId }) {
    const baseUrl = 'https://collab.csslabdev.com/api/1.3.0/getText';
  
    const data = new URLSearchParams();
    data.append('apikey', 'dc7f31dd34aff72519a368c4f90a319cf68377772617211575ab4ca457ed46a0');
    data.append('padID', padId);
  
    const options = {
      method: 'POST',
    };
  
    const result = await fetch(`${baseUrl}?${data.toString()}`, options)
      .then(response => {
        if (response.ok) {
          console.log(response);
          return response.clone().json();
        }
        throw new Error('Etherpad network response was not ok.');
        
      })
      .then(responseJson => responseJson.data?.text)
      .catch(error => {
        console.error(error);
        return error;
      }); 

      
  
    return result;
  }