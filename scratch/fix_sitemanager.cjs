const fs = require('fs');
const file = 'src/components/admin/SiteManager.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `      if (existing) {
        // Update existing row
        const { error } = await supabase
          .from('landing_avisos')
          .update({ mensagem: instagramFeedUrl })
          .eq('id', existing.id);`;

const replacement1 = `      let finalUrl = instagramFeedUrl.trim();
      
      // Auto-extract feed ID from widget code or dashboard URL
      const feedIdMatch = finalUrl.match(/feed-id="([^"]+)"/) || finalUrl.match(/behold\\.so\\/feeds\\/([^\\/]+)/) || finalUrl.match(/behold\\.so\\/v1\\/feeds\\/([^\\/]+)/);
      if (feedIdMatch && feedIdMatch[1]) {
        finalUrl = \`https://feeds.behold.so/\${feedIdMatch[1]}\`;
        setInstagramFeedUrl(finalUrl); // Update the input to show the clean URL
      }

      if (existing) {
        // Update existing row
        const { error } = await supabase
          .from('landing_avisos')
          .update({ mensagem: finalUrl })
          .eq('id', existing.id);`;

const target2 = `        // Insert new row
        const { error } = await supabase
          .from('landing_avisos')
          .insert([{
            titulo: 'INSTAGRAM_FEED_CONFIG',
            mensagem: instagramFeedUrl,`;

const replacement2 = `        // Insert new row
        const { error } = await supabase
          .from('landing_avisos')
          .insert([{
            titulo: 'INSTAGRAM_FEED_CONFIG',
            mensagem: finalUrl,`;

// Ensure we match regardless of line endings
content = content.replace(target1.replace(/\r\n/g, '\n'), replacement1);
content = content.replace(target1.replace(/\n/g, '\r\n'), replacement1);
content = content.replace(target2.replace(/\r\n/g, '\n'), replacement2);
content = content.replace(target2.replace(/\n/g, '\r\n'), replacement2);

fs.writeFileSync(file, content);
console.log('Fixed SiteManager.tsx');
