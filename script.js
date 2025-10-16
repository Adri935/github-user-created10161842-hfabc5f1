// Helper function to parse data URLs
function parseDataUrl(url) {
  if (!url.startsWith('data:')) return null;
  
  const parts = url.substring(5).split(',');
  const header = parts[0];
  const payload = parts[1];
  
  const mimeParts = header.split(';');
  const mime = mimeParts[0] || 'text/plain';
  const isBase64 = mimeParts.includes('base64');
  
  let text = '';
  if (isBase64) {
    try {
      const bytes = atob(payload);
      const decoder = new TextDecoder('utf-8');
      text = decoder.decode(Uint8Array.from(bytes, c => c.charCodeAt(0)));
    } catch (e) {
      console.error('Failed to decode base64 data URL');
    }
  } else {
    try {
      text = decodeURIComponent(payload);
    } catch (e) {
      console.error('Failed to decode URL-encoded data');
    }
  }
  
  return { mime, isBase64, text };
}

// Helper function to decode base64 to text
function decodeBase64ToText(b64) {
  try {
    const bytes = atob(b64);
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(Uint8Array.from(bytes, c => c.charCodeAt(0)));
  } catch (e) {
    console.error('Failed to decode base64 string');
    return '';
  }
}

// Helper function to parse CSV
function parseCsv(text) {
  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Remove BOM if present
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  
  // Detect delimiter
  const delimiters = [',', ';', '\t'];
  let delimiter = ',';
  let maxCount = 0;
  
  for (const delim of delimiters) {
    const count = (text.split('\n')[0].match(new RegExp(delim, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      delimiter = delim;
    }
  }
  
  // Parse rows
  const rows = text.split('\n').map(row => {
    // Handle quoted fields
    const regex = new RegExp(`${delimiter}(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)`);
    return row.split(regex).map(field => {
      // Remove surrounding quotes and unescape internal quotes
      if (field.startsWith('"') && field.endsWith('"')) {
        return field.substring(1, field.length - 1).replace(/""/g, '"');
      }
      return field;
    });
  }).filter(row => row.length > 1 || row[0] !== ''); // Remove empty rows
  
  // Infer header row
  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }
  
  const firstRow = rows[0];
  const isHeader = firstRow.every(cell => isNaN(parseFloat(cell)));
  
  if (isHeader) {
    return {
      headers: firstRow,
      rows: rows.slice(1)
    };
  }
  
  return {
    headers: null,
    rows
  };
}

// Get token from URL parameters
function getTokenFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('token');
}

// Format date to YYYY-MM-DD UTC
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

// Fetch user creation date from GitHub API
async function fetchUserCreationDate(username, token = null) {
  const url = `https://api.github.com/users/${username}`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'GitHub-User-Creation-Date-Fetcher'
  };
  
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  
  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('User not found');
      } else if (response.status === 403) {
        throw new Error('Rate limit exceeded. Please try again later or provide a token.');
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    }
    
    const data = await response.json();
    return data.created_at;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Network error. Please check your connection.');
    }
    throw error;
  }
}

// Handle form submission
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('github-user-r8s2');
  const usernameInput = document.getElementById('github-username');
  const createdAtElement = document.getElementById('github-created-at');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    if (!username) {
      createdAtElement.textContent = 'Please enter a username';
      createdAtElement.className = 'error';
      return;
    }
    
    // Show loading state
    form.classList.add('loading');
    createdAtElement.textContent = 'Loading...';
    createdAtElement.className = '';
    
    try {
      const token = getTokenFromUrl();
      const createdAt = await fetchUserCreationDate(username, token);
      const formattedDate = formatDate(createdAt);
      
      createdAtElement.textContent = formattedDate;
      createdAtElement.className = 'success';
    } catch (error) {
      createdAtElement.textContent = error.message;
      createdAtElement.className = 'error';
    } finally {
      form.classList.remove('loading');
    }
  });
});