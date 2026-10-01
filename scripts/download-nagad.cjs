const https = require('https');
const fs = require('fs');

https.get('https://logotyp.us/file/nagad.svg', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    let reactSvg = `import React from 'react';\n\nexport const NagadIcon: React.FC<{className?: string, size?: number}> = ({className = '', size = 24}) => (\n  <svg width={size} height={size} viewBox="0 0 560 400" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>\n    ` + data.replace(/<svg[^>]*>/, '').replace('</svg>', '') + `\n  </svg>\n);`;
    
    // Fix SVG attributes for React
    reactSvg = reactSvg
      .replace(/fill-rule/g, 'fillRule')
      .replace(/clip-rule/g, 'clipRule')
      .replace(/stroke-linejoin/g, 'strokeLinejoin')
      .replace(/stroke-miterlimit/g, 'strokeMiterlimit');
      
    fs.writeFileSync('src/components/icons/NagadIcon.tsx', reactSvg);
    console.log('Success: NagadIcon.tsx created.');
  });
});
