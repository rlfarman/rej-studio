import { NextApiRequest, NextApiResponse } from 'next'
import path from 'path'
import { promises as fs } from 'fs'

export default async function formHandler(
  req: NextApiRequest,
  res: NextApiResponse<string>
) {
  const dataDirectory = path.join(process.cwd(), 'public/data')
  //Read the json data file data.json
  const fileContents = await fs.readFile(dataDirectory + '/fake.zip', 'binary')
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Content-Disposition', 'attachment; filename=fake.zip')
  res.setHeader('Content-Length', fileContents.length)
  //Return the content of the data file in json format
  res.status(200).send(fileContents)
}
