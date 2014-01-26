wget http://downloads.sourceforge.net/project/graphicsmagick/graphicsmagick/1.3.19/GraphicsMagick-1.3.19.tar.bz2 && \
tar xjf GraphicsMagick-1.3.19.tar.bz2 && \
cd GraphicsMagick-1.3.19 && \
./configure --with-jpeg=yes --with-jp2=yes --with-png=yes --with-tiff=yes && \
make && sudo make install 

# feh is a console image viewer
# below is install feh

# wget http://feh.finalrewind.org/feh-2.9.3.tar.bz2 && \
# tar xjf feh-2.9.3.tar.bz2  && \
# cd feh-2.9.3 && \
# make && \
# sudo make install 

# sudo yum install  Imlib imlib-devel imlib2 imlib2-devel 

# wget http://linuxbrit.co.uk/downloads/giblib-1.2.4.tar.gz && \
# tar xzf giblib-1.2.4.tar.gz && \
# cd giblib-1.2.4 && \
# ./configure && \
# make && sudo make install

# sudo echo "/usr/local/lib" >> /etc/ld.so.conf && \
# ldconfig
