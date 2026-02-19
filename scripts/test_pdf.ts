
import { jsPDF } from 'jspdf'
import * as fs from 'fs'

async function testPdf() {
    try {
        console.log('Testing jsPDF in Node.js...')
        const doc = new jsPDF()
        doc.text('Hello World from Node.js', 10, 10)

        // Output as ArrayBuffer
        const buffer = doc.output('arraybuffer')

        // Save to file
        fs.writeFileSync('test_output.pdf', Buffer.from(buffer))
        console.log('PDF generated successfully: test_output.pdf')
    } catch (err) {
        console.error('Error generating PDF:', err)
    }
}

testPdf()
