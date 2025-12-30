import SparkMD5 from 'spark-md5';

export const generateFileMD5 = (file: File): Promise<{hex: string, base64: string}> => {
  return new Promise((resolve, reject) => {
    const blobSlice = File.prototype.slice || (File.prototype as any).mozSlice || (File.prototype as any).webkitSlice;
    const chunkSize = 2097152; // 2MB
    const chunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;
    const spark = new SparkMD5.ArrayBuffer();
    const fileReader = new FileReader();

    fileReader.onload = function (e) {
      if (e.target?.result) {
        spark.append(e.target.result as ArrayBuffer);
      }
      currentChunk++;

      if (currentChunk < chunks) {
        loadNext();
      } else {
        const hex = spark.end();
        
        // Convert Hex to Base64 manually
        const hexPairs = hex.match(/\w{2}/g) || [];
        const bytes = new Uint8Array(hexPairs.map((b) => parseInt(b, 16)));
        const base64 = btoa(String.fromCharCode(...bytes));
        
        resolve({ hex, base64 });
      }
    };

    fileReader.onerror = function () {
      reject('MD5 calculation failed');
    };

    function loadNext() {
      const start = currentChunk * chunkSize;
      const end = start + chunkSize >= file.size ? file.size : start + chunkSize;
      fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
    }

    loadNext();
  });
};
