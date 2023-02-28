import React from "react";

export function Qualtrics ({ style = "", testId = "unnamedunamQualtrics" }) {
    
    
    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', 'https://upenn.co1.qualtrics.com/jfe/form/SV_czNcL28CkElpBcO');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.style.width = '100%';
    iframe.style.height = '800px';
    qualtricsContainer.current.appendChild(iframe);
    
    return () => {
    qualtricsContainer.current.innerHTML = '';
     };
    }, []);    
  
  
    return (
    <div data-test={testId}>
      <div ref={qualtricsContainer} />
    </div>
  );
}
