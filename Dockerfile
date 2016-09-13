FROM node

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/

RUN npm install 

# Bundle app source
COPY . /usr/src/app

EXPOSE 5000
EXPOSE 5443
CMD [ "npm", "start" ]
